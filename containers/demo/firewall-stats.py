#!/usr/bin/python3
"""Bounded, read-only firewall snapshot with PTR, WHOIS and CIDR aggregates."""
import concurrent.futures
import ipaddress
import json
from pathlib import Path
import re
import subprocess


def command(args):
    try:
        r = subprocess.run(args, capture_output=True, text=True, timeout=3)
        return r.stdout.strip() if r.returncode == 0 else ''
    except (OSError, subprocess.TimeoutExpired):
        return ''


def addresses(rules):
    rows = {}
    for item in rules:
        group = item.get('set', {})
        if group.get('table') != 'filter' or group.get('name') not in ('drop_src4', 'drop_src6'):
            continue
        for raw in group.get('elem', []):
            elem = raw.get('elem', raw) if isinstance(raw, dict) else {}
            try:
                addr = str(ipaddress.ip_address(elem['val']))
            except (KeyError, ValueError, TypeError):
                continue
            counter = elem.get('counter', {})
            rows[addr] = {'ip': addr, 'packets': counter.get('packets', 0), 'bytes': counter.get('bytes', 0)}
    return sorted(rows.values(), key=lambda x: x['packets'], reverse=True)


def allocation_cidrs(text, address):
    ip = ipaddress.ip_address(address)
    networks = set()
    for line in text.splitlines():
        key, _, value = line.partition(':')
        try:
            if key.strip().lower() in ('cidr', 'route', 'route6') or (key.strip().lower() == 'inet6num' and '/' in value):
                for part in value.split(','):
                    net = ipaddress.ip_network(part.strip(), strict=False)
                    if ip.version == net.version and ip in net:
                        networks.add(str(net))
            elif key.strip().lower() in ('inetnum', 'inet6num', 'netrange') and '-' in value:
                lo, hi = [ipaddress.ip_address(x.strip()) for x in value.split('-', 1)]
                if lo.version == ip.version and lo <= ip <= hi:
                    networks.update(str(n) for n in ipaddress.summarize_address_range(lo, hi) if ip in n)
        except ValueError:
            continue
    # Prefer the most specific reported allocation to avoid counting one IP twice.
    return sorted(networks, key=lambda n: ipaddress.ip_network(n).prefixlen, reverse=True)[:1]


def enrich(row):
    addr = row['ip']
    if not ipaddress.ip_address(addr).is_global:
        return {**row, 'hostname': [], 'allocationCidrs': [], 'whois': '', 'lookupStatus': 'non_public_address'}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        ptr = pool.submit(command, ['dig', '+time=1', '+tries=1', '+short', '-x', addr])
        who = pool.submit(command, ['whois', addr])
        text = who.result()
        return {**row, 'hostname': ptr.result().splitlines()[:4],
                'allocationCidrs': allocation_cidrs(text, addr),
                'whois': '\n'.join(line for line in text.splitlines() if line.partition(':')[0].strip().lower() in {'netrange', 'cidr', 'inetnum', 'inet6num', 'route', 'route6', 'netname', 'orgname', 'organization', 'orgid', 'country', 'descr', 'owner', 'origin', 'originas'})[:4096]}


def aggregate(rows, allocation=False):
    totals = {}
    for row in rows:
        ip = ipaddress.ip_address(row['ip'])
        keys = row.get('allocationCidrs', []) if allocation else [str(ipaddress.ip_network(f'{ip}/{24 if ip.version == 4 else 64}', strict=False))]
        for cidr in keys:
            entry = totals.setdefault(cidr, {'cidr': cidr, 'packets': 0, 'bytes': 0, 'sources': 0})
            for key in ('packets', 'bytes'):
                entry[key] += row[key]
            entry['sources'] += 1
    return sorted(totals.values(), key=lambda x: x['packets'], reverse=True)


def snapshot():
    raw = command(['nft', '-j', 'list', 'ruleset'])
    try:
        rules = json.loads(raw)['nftables']
    except (ValueError, KeyError):
        return {'available': False, 'error': 'nft_ruleset_unavailable'}
    present = any(i.get('table', {}).get('family') == 'inet' and i['table'].get('name') == 'filter' for i in rules)
    counters = []
    for item in rules:
        rule = item.get('rule', {})
        if rule.get('family') != 'inet' or rule.get('table') != 'filter':
            continue
        for expr in rule.get('expr', []):
            if 'counter' in expr:
                counters.append({'chain': rule['chain'], 'handle': rule.get('handle'), **expr['counter']})
    rows = addresses(rules)
    # Limit expensive external lookups; prefix totals still include every source.
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        enriched = list(pool.map(enrich, rows[:10]))
    mode = Path('/run/nekoroot-firewall-mode')
    epoch = Path('/run/nekoroot-firewall-counter-epoch')
    return {'available': present, 'counterEpoch': epoch.read_text().strip() if epoch.exists() else None, 'mode': mode.read_text().strip() if mode.exists() else 'unknown',
            'ruleCounters': counters, 'sources': enriched + rows[10:], 'sourceCount': len(rows), 'lookupCount': len(enriched),
            'prefixTotals': aggregate(rows), 'allocationTotals': aggregate(enriched, True),
            'allocationCoverage': 'WHOIS results for up to 10 highest packet-count sources',
            'window': 'current kernel sets; sources expire after 1 day; reset on rule reload/restart'}


if __name__ == '__main__':
    print(json.dumps(snapshot(), ensure_ascii=False))
