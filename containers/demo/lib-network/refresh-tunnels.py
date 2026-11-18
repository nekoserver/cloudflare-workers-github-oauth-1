#!/usr/bin/python3
import json, os, urllib.request, urllib.error, sys, fcntl
from pathlib import Path
lock = open('/run/lib-api-tunnels.lock', 'w')
fcntl.flock(lock, fcntl.LOCK_EX)
account = os.environ['CLOUDFLARE_ACCOUNT_ID']
token = os.environ.get('CF_CONTAINER_API_TOKEN') or os.environ.get('CLOUDFLARE_API_TOKEN')
if not token:
    raise SystemExit('Cloudflare API token missing')
rows = []
page = 1
while True:
    url = f'https://api.cloudflare.com/client/v4/accounts/{account}/cfd_tunnel?is_deleted=false&per_page=100&page={page}'
    request = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
    with urllib.request.urlopen(request, timeout=20) as response:
        data = json.load(response)
    if not data.get('success'):
        raise RuntimeError('Cloudflare tunnel query failed')
    for row in data['result']:
        connections = row.get('connections') or []
        rows.append({'id': row.get('id'), 'name': row.get('name'),
                     'status': row.get('status', 'healthy' if connections else 'down'),
                     'created_at': row.get('created_at'),
                     'connections': [{'colo_name': c.get('colo_name', '')} for c in connections]})
    if page >= data.get('result_info', {}).get('total_pages', 1):
        break
    page += 1
# An active local connector must be visible in a complete account listing.
# A restricted token can return success with an empty list: reject that result.
expected = set()
for proc in Path('/proc').iterdir():
    if not proc.name.isdigit():
        continue
    try:
        args = (proc / 'cmdline').read_bytes().split(b'\0')
        if args and Path(os.fsdecode(args[0])).name == 'cloudflared' and b'--token' in args:
            import base64
            credential = json.loads(base64.b64decode(args[args.index(b'--token') + 1]))
            if credential.get('a') == account:
                expected.add(credential['t'])
    except (OSError, ValueError, IndexError, KeyError):
        continue
missing = expected - {row['id'] for row in rows}
if missing:
    denied = False
    for tunnel_id in missing:
        request = urllib.request.Request(
            f'https://api.cloudflare.com/client/v4/accounts/{account}/cfd_tunnel/{tunnel_id}',
            headers={'Authorization': f'Bearer {token}'})
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                result = json.load(response)
        except urllib.error.HTTPError as error:
            if error.code in (401, 403):
                denied = True
            else:
                raise
    print('tunnel_api_not_authorized: active tunnel missing from listing; API rejected access to active tunnel; check credential source and resource scope'
          if denied else 'tunnel_list_incomplete: active tunnel missing from listing', file=sys.stderr)
    raise SystemExit(1)
path = Path('/var/cache/lib-api/tunnels.json')
tmp = path.with_suffix('.tmp')
tmp.write_text(json.dumps(rows))
tmp.chmod(0o644)
tmp.replace(path)
print(f'Tunnel cache updated: {len(rows)} tunnels')
