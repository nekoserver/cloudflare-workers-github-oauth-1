#!/usr/bin/python3
"""Persist kernel drop messages and counter deltas without requiring nft_log."""
import importlib.util
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import threading
from datetime import datetime, timezone

spec = importlib.util.spec_from_file_location('firewall_stats', Path(__file__).with_name('firewall-stats.py'))
stats = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stats)

LOG = Path('/tmp/firewall.log')
STOP = threading.Event()
LOCK = threading.Lock()


def write_log(message):
    # Reopen on each write so both this process and entrypoint can append safely
    # after rotation. Keep four files of at most roughly 5 MiB each.
    with LOCK:
        if LOG.exists() and LOG.stat().st_size >= 5 * 1024 * 1024:
            for number in (3, 2, 1):
                old = Path(str(LOG) + (f'.{number - 1}' if number > 1 else ''))
                if old.exists():
                    old.replace(Path(str(LOG) + f'.{number}'))
        fd = os.open(LOG, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
        with os.fdopen(fd, 'a') as stream:
            stamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
            stream.write(f'{stamp} {socket.gethostname()} firewall: {message}\n')


def counter_values(document):
    rules = document['nftables']
    values = {}
    for row in stats.addresses(rules):
        values[f'SRC={row["ip"]}'] = (row['packets'], row['bytes'])
    for item in rules:
        rule = item.get('rule', {})
        if rule.get('family') != 'inet' or rule.get('table') != 'filter':
            continue
        for expression in rule.get('expr', []):
            if 'counter' in expression:
                count = expression['counter']
                values[f'CHAIN={rule["chain"]} HANDLE={rule["handle"]}'] = (count['packets'], count['bytes'])
    return values


def counter_changes(previous, current):
    for key, (packets, size) in current.items():
        before_packets, before_size = previous.get(key, (0, 0))
        # A reset or an expired/recreated source starts a new counter interval.
        if packets < before_packets or size < before_size:
            before_packets = before_size = 0
        if packets > before_packets:
            yield f'DROP_COUNTER {key} packets_delta={packets - before_packets} bytes_delta={size - before_size} packets_total={packets}'


def kernel_reader():
    try:
        process = subprocess.Popen(['dmesg', '--follow-new', '--notime'], stdout=subprocess.PIPE,
                                   stderr=subprocess.STDOUT, text=True, env={**os.environ, 'LC_ALL': 'C'})
    except OSError as error:
        write_log(f'kernel reader unavailable: {error}; counter logging continues')
        return
    def shutdown(*_args):
        if process.poll() is None:
            process.terminate()
    # The main thread owns signal handling; the watcher stops this reader.
    def watch():
        STOP.wait()
        shutdown()
    threading.Thread(target=watch, daemon=True).start()
    try:
        for line in process.stdout:
            if 'nft-drop ' in line or line.startswith('dmesg:'):
                write_log(line.rstrip())
    finally:
        shutdown()
        process.wait()
        process.stdout.close()
        if not STOP.is_set():
            write_log(f'kernel reader stopped status={process.returncode}; counter logging continues')


def main():
    os.umask(0o077)
    signal.signal(signal.SIGTERM, lambda *_: STOP.set())
    signal.signal(signal.SIGINT, lambda *_: STOP.set())
    mode_file = Path('/run/nekoroot-firewall-mode')
    mode = mode_file.read_text().strip() if mode_file.exists() else 'unknown'
    write_log(f'collector started mode={mode}; counters sampled every 10 seconds; timestamps are collection time')
    if mode == 'rate-limited-log':
        threading.Thread(target=kernel_reader, daemon=True).start()
    else:
        write_log('per-packet kernel logging unavailable; recording actual drop-counter deltas instead')
    previous, last_error, epoch = {}, None, None
    samples = 0
    while not STOP.is_set():
        try:
            result = subprocess.run(['nft', '-j', 'list', 'table', 'inet', 'filter'],
                                    capture_output=True, text=True, timeout=5)
            if result.returncode:
                raise RuntimeError(result.stderr.strip()[:1000] or f'nft status={result.returncode}')
            epoch_file = Path('/run/nekoroot-firewall-counter-epoch')
            current_epoch = epoch_file.read_text() if epoch_file.exists() else None
            if current_epoch != epoch:
                previous, epoch = {}, current_epoch
                write_log('counter epoch changed; starting a new baseline')
            current = counter_values(json.loads(result.stdout))
            if last_error:
                write_log('counter collection recovered')
            for message in counter_changes(previous, current):
                write_log(message)
            previous, last_error = current, None
            if samples % 6 == 0:
                write_log(f'collector healthy mode={mode} tracked_counters={len(current)}')
        except (OSError, ValueError, KeyError, RuntimeError, subprocess.TimeoutExpired) as error:
            detail = str(error).replace('\n', ' ')
            if detail != last_error:
                write_log(f'counter collection failed: {detail}')
            last_error = detail
        samples += 1
        STOP.wait(10)
    write_log('collector stopped')


if __name__ == '__main__':
    main()
