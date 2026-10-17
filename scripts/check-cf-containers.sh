#!/bin/bash
# /cf-containers(デモコンテナ)まわりの変更を、push前にローカルで検証する。
# Workers BuildsのPRビルドはコンテナイメージをビルドしないため、これを
# 実行せずにmainへマージすると本番ビルドが一発勝負になる(CLAUDE.mdルール参照)。
#
# 使い方: bash scripts/check-cf-containers.sh [--offline]
#   --offline  外部ダウンロード(cloudflared/tailscale/npm -g)を除いてビルドする。
#              外部へ出られないサンドボックス用。省略時は本番と同じDockerfileでビルドする。
set -euo pipefail
cd "$(dirname "$0")/.."

OFFLINE=0
[ "${1:-}" = "--offline" ] && OFFLINE=1
IMAGE=cf-demo:check
NAME=cf-demo-check

step() { echo; echo "=== $*"; }

step "1/4 /cf-containers関連テスト(ページscriptの構文チェックを含む)"
npx vitest run \
  src/views/cfContainers.script-syntax.test.ts \
  src/utils/cfBuildsApi.test.ts \
  src/utils/cfWorkerSecretApi.test.ts \
  src/utils/cloudflareTunnelApi.test.ts \
  src/utils/cfContainerCost.test.ts \
  src/utils/cfContainerOperationLog.test.ts \
  $(ls src/*.test.ts | grep -i container)

step "2/4 Workerのバンドル(wrangler deploy --dry-run)"
npx wrangler deploy --dry-run --containers-rollout=none --outdir /tmp/cf-check-wrangler-out >/dev/null
echo "OK"

step "3/4 コンテナイメージのビルド"
CTX=containers/demo
if [ "$OFFLINE" = 1 ]; then
  CTX=$(mktemp -d)
  cp -r containers/demo/. "$CTX"/
  python3 - "$CTX/Dockerfile" <<'EOF'
import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
a = s.index('    && rm -rf /var/lib/apt/lists/*')
b = s.index('WORKDIR /app')
open(p, 'w', encoding='utf-8').write(s[:a] + '    && rm -rf /var/lib/apt/lists/*\n\n' + s[b:])
EOF
  echo "WARN: --offline のため cloudflared/tailscale/npm -g のダウンロードは検証していない"
fi
BUILD_ARGS=()
if [ "$OFFLINE" = 0 ] && [ -n "${HTTPS_PROXY:-}" ] && [ -f /root/.ccr/ca-bundle.crt ]; then
  # Claude Codeのクラウドサンドボックス: HTTPSはMITMプロキシ経由でしか外に出られない。
  # ビルド用コピーにプロキシのCAとhttps_proxyだけを足し(aptのhttpは直接出られる)、
  # --network hostでビルドコンテナからホストの127.0.0.1のプロキシへ届くようにする。
  CTX=$(mktemp -d)
  cp -r containers/demo/. "$CTX"/
  cp /root/.ccr/ca-bundle.crt "$CTX/proxy-ca.crt"
  python3 - "$CTX/Dockerfile" "$HTTPS_PROXY" <<'EOF2'
import sys
p, proxy = sys.argv[1], sys.argv[2]
ca = '/usr/local/share/ca-certificates/proxy-ca.crt'
inj = (f'FROM ubuntu:24.04\nCOPY proxy-ca.crt {ca}\n'
       f'ENV https_proxy={proxy} HTTPS_PROXY={proxy} SSL_CERT_FILE={ca} CURL_CA_BUNDLE={ca} '
       f'NODE_EXTRA_CA_CERTS={ca} npm_config_cafile={ca}\n')
s = open(p, encoding='utf-8').read()
open(p, 'w', encoding='utf-8').write(s.replace('FROM ubuntu:24.04\n', inj, 1))
EOF2
  BUILD_ARGS=(--network host)
  echo "INFO: サンドボックスのプロキシ経由で本番と同じダウンロード込みのビルドを行う"
fi
docker build -q "${BUILD_ARGS[@]}" -t "$IMAGE" "$CTX" >/dev/null
docker image ls "$IMAGE" --format 'image size: {{.Size}} (standard-1の上限は8GB)'
# 本番ビルドは巨大な単一レイヤーのアップロードがタイムアウトして失敗した(2026-10-17)。
# 1レイヤーがこれを超えたらNGにする。
MAX_LAYER_MB=${MAX_LAYER_MB:-800}
python3 - "$IMAGE" "$MAX_LAYER_MB" <<'EOF3'
import json, subprocess, sys
image, limit = sys.argv[1], int(sys.argv[2])
out = subprocess.run(['docker', 'history', '--no-trunc', '--format', '{{json .}}', image], capture_output=True, text=True, check=True).stdout
units = {'B': 1, 'kB': 1e3, 'KB': 1e3, 'MB': 1e6, 'GB': 1e9}
big = []
for line in out.splitlines():
    h = json.loads(line)
    size = h['Size']
    num = float(''.join(c for c in size if c.isdigit() or c == '.') or 0)
    unit = ''.join(c for c in size if c.isalpha()) or 'B'
    mb = num * units.get(unit, 1) / 1e6
    if mb > limit:
        big.append(f'{size} {h["CreatedBy"][:100]}')
if big:
    print(f'NG: {limit}MBを超えるレイヤーがある(レジストリへのアップロードがタイムアウトしうる):')
    print('\n'.join(big))
    sys.exit(1)
print(f'OK: 全レイヤーが{limit}MB以下')
EOF3
docker run --rm --entrypoint bash "$IMAGE" -c '
  set -e
  node --version >/dev/null
  ip -V >/dev/null; ss -V >/dev/null; ping -V >/dev/null; dig -v >/dev/null 2>&1
  node --check /usr/local/bin/cf
  node --check /app/server.js
  command -v codex >/dev/null || { echo "NG: codex CLIが入っていない"; exit 1; }
  if command -v cloudflared >/dev/null; then cloudflared --version; else echo "WARN: cloudflaredなし(--offline時は想定どおり)"; fi
'

step "4/4 コンテナを起動して/health・8443を確認"
docker rm -f "$NAME" >/dev/null 2>&1 || true
# 本番と同じくnftablesを実際に効かせるためNET_ADMINを付け、外(ホスト側)から8080へ届くかも確認する
docker run -d --name "$NAME" --cap-add NET_ADMIN -p 127.0.0.1::8080 "$IMAGE" >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
HEALTH=""
for _ in $(seq 1 30); do
  HEALTH=$(docker exec "$NAME" curl --noproxy '*' -fsS http://127.0.0.1:8080/health 2>/dev/null) && break
  sleep 2
done
echo "/health: $HEALTH"
HOST_PORT=$(docker port "$NAME" 8080/tcp | head -1 | sed 's/.*://')
docker logs "$NAME" 2>&1 | grep -a "nftables" || true
curl --noproxy '*' -fsS -m 8 "http://127.0.0.1:${HOST_PORT}/health" >/dev/null \
  || { echo "NG: コンテナの外から8080に届かない(Workerからの操作が応答しなくなる。nftablesの許可漏れ等)"; docker logs "$NAME"; exit 1; }
echo "OK: 外から8080に届く"
curl --noproxy '*' -fsS -m 8 "http://127.0.0.1:${HOST_PORT}/debug/logs" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert "/tmp/cloudflared.log" in d["logs"]; print("OK: /debug/logs")' \
  || { echo "NG: /debug/logsが返らない"; exit 1; }
docker exec "$NAME" curl --noproxy '*' -fsSk https://127.0.0.1:8443/health >/dev/null \
  || { echo "NG: Apache(8443)経由でserver.jsに届かない"; docker logs "$NAME"; exit 1; }
python3 -c '
import json, sys
h = json.loads(sys.argv[1])
missing = [k for k in ("apache", "sshd") if h.get(k) is not True]
if missing:
    sys.exit(f"NG: 起動していないサービス: {missing}")
' "$HEALTH" || { docker logs "$NAME"; exit 1; }

echo; echo "ALL OK"
