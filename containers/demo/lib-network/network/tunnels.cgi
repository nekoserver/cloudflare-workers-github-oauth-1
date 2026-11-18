#!/bin/sh
if [ -z "${ORIGIN_HMAC_SECRET:-}${HMAC_SECRET:-}" ]; then
    set -a
    . /etc/lib-hmac.env
    set +a
fi
# 現在ENVを優先し、不足する既存設定だけを保存値から補う。
eval "$(/usr/bin/python3 - <<'PYENV'
import os,shlex
from pathlib import Path
p=Path('/etc/lib-tunnels.env')
if p.exists():
 for line in p.read_text().splitlines():
  if not line.strip() or line.lstrip().startswith('#'):continue
  key,raw=line.split('=',1)
  if key in ('CF_CONTAINER_API_TOKEN','CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID') and not os.environ.get(key):
   print('export '+key+'='+shlex.quote(' '.join(shlex.split(raw))))
PYENV
)"
export LIB_TUNNELS_CACHE=/var/cache/lib-api/tunnels.json
exec /usr/local/bin/ruby /var/www/html/lib/api/tunnels.rb
