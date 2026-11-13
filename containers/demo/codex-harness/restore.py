#!/usr/bin/env python3
"""Merge the bundled language hooks. Never edits hook trust or Codex permissions."""
import copy
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shlex
import tempfile
import time

BUNDLE = Path(__file__).resolve().parent

def restore(home):
    home.mkdir(parents=True, exist_ok=True)
    target = home / 'hooks.json'
    if home.is_symlink() or target.is_symlink():
        raise ValueError('Refusing a symlink hook configuration')
    lock = home / '.japanese-hooks-restore.lock'
    fd = os.open(lock, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'a') as stream:
        fcntl.flock(stream, fcntl.LOCK_EX)
        previous = target.read_bytes() if target.exists() else None
        data = json.loads(previous) if previous is not None else {}
        if not isinstance(data, dict) or not isinstance(data.get('hooks', {}), dict):
            raise ValueError('Existing hook configuration is invalid')
        template = json.loads((BUNDLE / 'hooks.json').read_text())
        script = shlex.quote(str(BUNDLE / 'japanese.py'))
        pr_state_script = shlex.quote(str(BUNDLE / 'pr-state.py'))
        command = '/usr/bin/python3 ' + script
        merged = copy.deepcopy(data)
        merged.setdefault('description', template['description'])
        hooks = merged.setdefault('hooks', {})
        for event, groups in template['hooks'].items():
            existing = hooks.get(event, [])
            if not isinstance(existing, list):
                raise ValueError('Existing hook event is invalid')
            kept = []
            for group in existing:
                if not isinstance(group, dict) or not isinstance(group.get('hooks'), list):
                    raise ValueError('Existing hook group is invalid')
                if any(not isinstance(handler, dict) for handler in group['hooks']):
                    raise ValueError('Existing hook handler is invalid')
                handlers = [handler for handler in group['hooks'] if handler.get('command') != command]
                if handlers:
                    kept.append({**group, 'hooks': handlers})
            additions = copy.deepcopy(groups)
            for group in additions:
                for handler in group['hooks']:
                    handler['command'] = handler['command'].replace('__HARNESS_SCRIPT__', script)
                    handler['command'] = handler['command'].replace('__PR_STATE_SCRIPT__', pr_state_script)
            hooks[event] = kept + additions
        output = (json.dumps(merged, ensure_ascii=False, indent=2) + '\n').encode()
        if previous == output:
            target.chmod(0o600)
            return 'unchanged'
        if previous is not None:
            history = home / 'hook-backups'
            if history.is_symlink():
                raise ValueError('Refusing a symlink backup directory')
            history.mkdir(mode=0o700, exist_ok=True)
            history.chmod(0o700)
            name = str(time.time_ns()) + '-' + hashlib.sha256(previous).hexdigest()[:12] + '.json'
            backup_fd = os.open(history / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(backup_fd, 'wb') as backup:
                backup.write(previous)
        temp_fd, temp_name = tempfile.mkstemp(prefix='.hooks.', dir=home)
        try:
            with os.fdopen(temp_fd, 'wb') as output_file:
                os.fchmod(output_file.fileno(), 0o600)
                output_file.write(output)
                output_file.flush()
                os.fsync(output_file.fileno())
            os.replace(temp_name, target)
        finally:
            Path(temp_name).unlink(missing_ok=True)
        return 'restored'

if __name__ == '__main__':
    try:
        home = Path(os.environ.get('CODEX_HOME') or str(Path.home() / '.codex'))
        state = restore(home)
        print('Codex Japanese hooks: ' + state + '; review new definitions in /hooks (trust unchanged)')
    except (OSError, ValueError, TypeError, KeyError):
        raise SystemExit('Codex Japanese hooks: restore failed; existing settings retained')
