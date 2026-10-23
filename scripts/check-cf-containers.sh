#!/bin/bash
# /cf-containers(デモコンテナ)まわりの変更を、push前にローカルで検証する。
# Workers BuildsのPRビルドはコンテナイメージをビルドしないため、これを
# 実行せずにmainへマージすると本番ビルドが一発勝負になる(CLAUDE.mdルール参照)。
#
# 使い方: bash scripts/check-cf-containers.sh
# 必須のNode/CLIを除去した別イメージでは、本番構成を検証できない。
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "${1:-}" = "--offline" ]; then
  echo "ERROR: --offline removes required Node/CLI runtimes and cannot validate this image. Run the full build with network access." >&2
  exit 2
fi
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
BUILD_ARGS=()
if [ -n "${HTTPS_PROXY:-}" ] && [ -f /root/.ccr/ca-bundle.crt ]; then
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
extra = [f'COPY proxy-ca.crt {ca}',
         f'ENV https_proxy={proxy} HTTPS_PROXY={proxy} SSL_CERT_FILE={ca} CURL_CA_BUNDLE={ca} '
         f'NODE_EXTRA_CA_CERTS={ca} npm_config_cafile={ca} PIP_CERT={ca} CARGO_HTTP_CAINFO={ca}']
lines = open(p, encoding='utf-8').read().split('\n')
# FROM行(ベースイメージのバージョン)に依存せず、最初のFROMの直後に挿入する
# マルチステージのビルドでは各FROMごとにCAが必要なので、すべてのFROMの直後に挿入する
out = []
for l in lines:
    out.append(l)
    if l.startswith('FROM '):
        out.extend(extra)
lines = out
open(p, 'w', encoding='utf-8').write('\n'.join(lines))
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
  gh --version
  ip -V >/dev/null; ss -V >/dev/null; ping -V >/dev/null; dig -v >/dev/null 2>&1
  node --check /usr/local/bin/cf
  node --check /app/server.js
  for c in netstat top whois dig ping; do command -v $c >/dev/null || { echo "NG: $c が入っていない"; exit 1; }; done
  command -v codex >/dev/null || { echo "NG: codex CLIが入っていない"; exit 1; }
  codex --version
  claude --version
  node -e "if (parseInt(process.versions.node) < 22) process.exit(1)"
  test -x /opt/node22/lib/node_modules/@openai/codex/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/bin/codex-code-mode-host
  if command -v cloudflared >/dev/null; then cloudflared --version; else echo "WARN: cloudflaredなし(--offline時は想定どおり)"; fi
'

step "3.5 トンネルトークンの取り出し(entrypoint.shのextract_tunnel_token)"
FN=$(sed -n '/^extract_tunnel_token() {/,/^}/p' containers/demo/entrypoint.sh)
TOK='eyJhIjoiYWJjIiwidCI6ImRlZiIsInMiOiJnaGkifQ=='
for input in "$TOK" "  $TOK
" "cloudflared service install $TOK" "sudo cloudflared tunnel run --token $TOK" "\"$TOK\""; do
  got=$(bash -c "$FN"'; extract_tunnel_token "$1"' _ "$input")
  [ "$got" = "$TOK" ] || { echo "NG: トークンの取り出しに失敗(入力の形: $(printf '%s' "$input" | cut -c1-30)...)"; exit 1; }
done
echo "OK: コマンドごと・空白/改行・引用符付きのトークンから本体を取り出せる"

step "4/4 コンテナを起動して/health・8443を確認"
docker rm -f "$NAME" >/dev/null 2>&1 || true
# 本番と同じくnftablesを実際に効かせるためNET_ADMINを付け、外(ホスト側)から8080へ届くかも確認する
# 本番は起動のたびに/runが空になる。--tmpfs /runで同じ条件にする(Dockerfileで作ったディレクトリに頼ると本番で壊れる)
# GH_TOKENはダミー(通信はしない)。SSH用の書き出しとgitの認証設定を確認するため
docker run -d --name "$NAME" --cap-add NET_ADMIN --tmpfs /run -e GH_TOKEN=dummy-token-for-check -p 127.0.0.1::8080 "$IMAGE" >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
HEALTH=""
for _ in $(seq 1 30); do
  HEALTH=$(docker exec "$NAME" curl --noproxy '*' -fsS http://127.0.0.1:8080/health 2>/dev/null) && break
  sleep 2
done
echo "/health: $HEALTH"
echo "$HEALTH" | python3 -c 'import json,sys; d=json.load(sys.stdin); v={i["name"]:i for i in d["versions"]["items"]}; [print("  version:", i["name"], i["actual"], "expected="+str(i["expected"]), i["level"]) for i in d["versions"]["items"]]; assert v["node"]["level"]=="ok", v["node"]; assert d["versions"]["expectedError"] is None, d["versions"]["expectedError"]; assert len(d["build"].get("commit") or "")==40, d["build"]; print("OK: /healthのバージョン表(nodeが想定どおり・image-versions.jsonを読めた)とビルド情報(commit "+d["build"]["commit"][:7]+")")' \
  || { echo "NG: /healthのバージョン表が想定と違う"; exit 1; }
HOST_PORT=$(docker port "$NAME" 8080/tcp | head -1 | sed 's/.*://')
docker logs "$NAME" 2>&1 | grep -a "nftables" || true
curl --noproxy '*' -fsS -m 8 "http://127.0.0.1:${HOST_PORT}/health" >/dev/null \
  || { echo "NG: コンテナの外から8080に届かない(Workerからの操作が応答しなくなる。nftablesの許可漏れ等)"; docker logs "$NAME"; exit 1; }
echo "OK: 外から8080に届く"
docker exec "$NAME" env -i HOME=/root TERM=xterm bash -lc '[ "$GH_TOKEN" = dummy-token-for-check ] && git config --global --get-regexp "credential.*helper" | grep -q "gh auth git-credential"' \
  && echo "OK: SSHのシェルでGH_TOKENが読め、gitの認証がghに設定されている" \
  || { echo "NG: GH_TOKENの書き出しかgh auth setup-gitが効いていない"; docker exec "$NAME" cat /tmp/gh-setup-git.log; exit 1; }
# SSHのセッションと同じ条件(空の環境のログインシェル)で主要コマンドが見つかるか
docker exec "$NAME" env -i HOME=/root TERM=xterm bash -lc 'for c in node npm codex claude wrangler gh jj git cf ruby gem; do command -v "$c" >/dev/null || { echo "missing: $c"; exit 1; }; done' \
  && echo "OK: SSHと同じ条件で node/npm/codex/claude/wrangler/gh/jj/git/cf/ruby/gem が見つかる" \
  || { echo "NG: SSHのログインシェルで見つからないコマンドがある"; exit 1; }
docker exec "$NAME" env -i HOME=/root TERM=xterm bash -ic 'command -v npx >/dev/null && echo "$PATH" | grep -q /opt/node22/bin' 2>/dev/null \
  && echo "OK: ログインしない対話シェルでもPATHに/opt/node22/binが入る" \
  || { echo "NG: 対話シェル(bash -i)のPATHに/opt/node22/binが無い"; exit 1; }
docker exec "$NAME" sh -c 'head -1 /etc/resolv.conf' | grep -q '^nameserver 1.1.1.1' \
  || { echo "NG: resolv.confの先頭がIPv4のリゾルバ(1.1.1.1)になっていない"; docker exec "$NAME" cat /etc/resolv.conf; exit 1; }
echo "OK: resolv.confの先頭が1.1.1.1"
curl --noproxy '*' -fsS -m 8 "http://127.0.0.1:${HOST_PORT}/debug/logs" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert "/tmp/cloudflared.log" in d["logs"]; assert "1.1.1.1" in d["logs"]["/tmp/dns.log"]; print("OK: /debug/logs")' \
  || { echo "NG: /debug/logsが返らない"; exit 1; }
curl --noproxy '*' -fsS -m 30 "http://127.0.0.1:${HOST_PORT}/debug/net" | python3 -c 'import json,sys; d=json.load(sys.stdin); missing=[k for k in ("addr","route","netstat","netstatLegacy","top","digDefault","digV4","whois","ping","nftRuleset","dropLog") if k not in d]; assert not missing, missing; assert "set drop_src6" in d["nftRuleset"], d["nftRuleset"][:500]; print("OK: /debug/net (top/netstat/dig/whois/ping含む)")' \
  || { echo "NG: /debug/netの項目が足りない"; exit 1; }
docker exec "$NAME" curl --noproxy '*' -fsSk https://127.0.0.1:8443/health >/dev/null \
  || { echo "NG: Apache(8443)経由でserver.jsに届かない"; docker logs "$NAME"; exit 1; }
# Public TLS ingress must not expose diagnostics; authenticated management
# access through :8080 remains available to the checks above.
for debug_path in /debug /debug/logs /debug/net; do
  status=$(docker exec "$NAME" curl --noproxy '*' -sk -o /dev/null -w '%{http_code}' "https://127.0.0.1:8443${debug_path}")
  [ "$status" = 403 ] || { echo "NG: public diagnostics returned $status for $debug_path"; exit 1; }
done
python3 -c '
import json, sys
h = json.loads(sys.argv[1])
missing = [k for k in ("apache", "sshd") if h.get(k) is not True]
if missing:
    sys.exit(f"NG: 起動していないサービス: {missing}")
' "$HEALTH" || { docker logs "$NAME"; exit 1; }

echo; echo "ALL OK"
