#!/bin/bash
# デモコンテナの起動スクリプト。自己署名証明書の生成、sshd・Apache・
# nftablesファイアウォール・cloudflared(nekorootトンネル)のセットアップを
# 行ってから、最後にCMD(node server.js)をexecする。
#
# 故障時の方針: ファイアウォール・トンネルの設定に失敗してもserver.js自体
# (/cf-containersページが起動確認に使う)は動き続けられるよう、各ステップは
# 失敗してもログに残してentrypoint全体は継続する(set -eにしない)。
set -u

log() { echo "[entrypoint] $*"; }

# 本番(Cloudflare Containers)では起動のたびに/runが空になるため、Dockerfileで作ったディレクトリは
# 残らない(2026-10-17: sshdが"Missing privilege separation directory: /run/sshd"、Apacheが
# "/var/lock/apache2: No such file or directory"で起動していなかった)。ここで毎回作る。
mkdir -p /run/sshd /run/lock /run/apache2 /var/lock/apache2 2>/dev/null || true

# 本番の既定DNSはIPv6のリゾルバ(2606:4700:4700::1111・2620:fe::fe)だけで、このコンテナからは
# 引けない(2026-10-17、/debug/netのdigで確認。@1.1.1.1なら引ける)。cloudflaredがエッジの
# 名前解決に失敗して終了していたため、IPv4のリゾルバを先頭に置く。
if ! grep -q '^nameserver 1.1.1.1' /etc/resolv.conf 2>/dev/null; then
  { printf 'nameserver 1.1.1.1\nnameserver 1.0.0.1\n'; grep -v '^nameserver' /etc/resolv.conf 2>/dev/null; } > /tmp/resolv.conf.new \
    && cat /tmp/resolv.conf.new > /etc/resolv.conf \
    && log "resolv.conf: IPv4のリゾルバ(1.1.1.1/1.0.0.1)に置き換えた" \
    || log "WARN: resolv.confを書き換えられなかった"
fi

# 貼り付けられたトンネルトークンから本体(eyJで始まるbase64)だけを取り出す。
# 「cloudflared service install eyJ...」のようにコマンドごと貼られた場合や、
# 前後の空白・改行・引用符が混ざった場合でも通るようにする。値そのものは出力しない。
extract_tunnel_token() {
  local raw="$1" tok
  tok=$(printf '%s' "$raw" | grep -oE 'eyJ[A-Za-z0-9+/=_-]+' | tail -n 1)
  if [ -n "$tok" ]; then printf '%s' "$tok"; else printf '%s' "$raw" | tr -d '[:space:]"'"'"; fi
}

# --- 自己署名証明書(Apache用、10年有効) ---
TLS_DIR=/etc/apache2/tls
if [ ! -f "$TLS_DIR/nekoroot.crt" ]; then
  mkdir -p "$TLS_DIR"
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "$TLS_DIR/nekoroot.key" -out "$TLS_DIR/nekoroot.crt" \
    -subj "/CN=nekoroot-demo" \
    >/tmp/openssl.log 2>&1 \
    && log "self-signed cert generated" \
    || log "WARN: cert generation failed, see /tmp/openssl.log"
  chmod 600 "$TLS_DIR/nekoroot.key" 2>/dev/null || true
fi

# --- sshd: ホスト鍵・authorized_keys ---
ssh-keygen -A >/tmp/sshkeygen.log 2>&1 || log "WARN: ssh-keygen -A failed"
mkdir -p /root/.ssh
chmod 700 /root/.ssh
# wrangler.tomlのcontainers.authorized_keysと同じ公開鍵(公開情報のため
# 埋め込みで問題ない)。wrangler containers sshとは別に、nekorootトンネル
# 経由の直接sshでも同じ鍵でログインできるようにする。
cat > /root/.ssh/authorized_keys <<'EOF'
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJM8/iV+DiD+cTQQgadOhHKkTUR+2ldz9ocGxC45sRbD admin
EOF
chmod 600 /root/.ssh/authorized_keys
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
/usr/sbin/sshd >/tmp/sshd.log 2>&1 &
log "sshd started (pid $!)"

# --- ファイアウォール ---
# INPUT: ループバック・確立済み/関連・新規(NEW)を許可し、不正(invalid)のみ破棄する。
#   (2026-10-17: 以前はNEWを破棄していたため、WorkerからDurable Object経由で
#    8080へ入る接続まで破棄され、/cf-containersの操作がすべて応答しなくなった)
# FORWARD: 許可。
if command -v nft >/dev/null 2>&1; then
  {
    nft add table inet filter 2>/dev/null
    nft add chain inet filter input '{ type filter hook input priority 0; policy drop; }' 2>/dev/null
    nft add chain inet filter forward '{ type filter hook forward priority 0; policy accept; }' 2>/dev/null
    nft flush chain inet filter input
    nft flush chain inet filter forward
    nft add rule inet filter input iif lo accept
    nft add rule inet filter input ct state invalid drop
    nft add rule inet filter input ct state established,related,new accept
  } >/tmp/nftables.log 2>&1 \
    && log "nftables INPUT: lo/established/related/new accept, invalid drop / FORWARD: accept" \
    || log "WARN: nftables setup failed (see /tmp/nftables.log; kernel may not support nf_tables in this environment)"
else
  log "WARN: nft command not found, firewall not applied"
fi

# --- Apache(server.jsへのTLSプロキシ) ---
apache2ctl configtest >/tmp/apache-configtest.log 2>&1 \
  && (apache2ctl start >/tmp/apache.log 2>&1 && log "apache2 started") \
  || log "WARN: apache2 configtest/start failed, see /tmp/apache-configtest.log /tmp/apache.log"

# --- cloudflared(nekorootトンネル) ---
NEKOROOT_TUNNEL_TOKEN=$(extract_tunnel_token "${NEKOROOT_TUNNEL_TOKEN:-}")
if [ -n "$NEKOROOT_TUNNEL_TOKEN" ]; then
  case "$NEKOROOT_TUNNEL_TOKEN" in
    eyJ*) log "tunnel token: eyJ形式として取り出した(長さ${#NEKOROOT_TUNNEL_TOKEN})" ;;
    *) log "WARN: tunnel tokenにeyJで始まる部分が無い(長さ${#NEKOROOT_TUNNEL_TOKEN})。ダッシュボードのトンネルのトークンを貼り直すこと" ;;
  esac
fi
if [ -n "${NEKOROOT_HOSTNAME:-}" ] && [ -n "${NEKOROOT_TUNNEL_TOKEN:-}" ]; then
  sed "s/__NEKOROOT_HOSTNAME__/${NEKOROOT_HOSTNAME}/g" \
    /etc/cloudflared/ingress.yml.template > /etc/cloudflared/ingress.yml
  # --metrics: server.jsの/healthがローカルの/readyを叩いて接続状態を
  # 確認できるようにする(127.0.0.1限定、外部には公開しない)。
  # --edge-ip-version 4: このコンテナはIPv6で外に出られない(DNSも含む)ため。
  # 終了しても5秒後に起動し直す(終了のたびにログへ記録する)。
  (
    while true; do
      cloudflared tunnel --config /etc/cloudflared/ingress.yml --metrics 127.0.0.1:20241 \
        --edge-ip-version 4 run --token "${NEKOROOT_TUNNEL_TOKEN}"
      echo "[entrypoint] cloudflared exited (code $?) at $(date -u +%FT%TZ), restarting in 5s"
      sleep 5
    done
  ) >>/tmp/cloudflared.log 2>&1 &
  log "cloudflared(nekoroot) supervisor started (pid $!), hostname=${NEKOROOT_HOSTNAME}"
else
  log "NEKOROOT_HOSTNAME/NEKOROOT_TUNNEL_TOKEN未設定のため、cloudflaredは起動しない"
fi

# --- tailscaled ---
# /dev/net/tunがこの環境で使えるか未確認のため、TUNデバイス不要の
# userspace-networkingモードで起動する(確実性を優先、通常のTUNモードより
# 低速だが接続経路の有無自体は変わらない)。
if [ -n "${TAILSCALE_AUTHKEY:-}" ]; then
  mkdir -p /var/lib/tailscale /var/run/tailscale
  /usr/sbin/tailscaled \
    --state=/var/lib/tailscale/tailscaled.state \
    --socket=/var/run/tailscale/tailscaled.sock \
    --tun=userspace-networking \
    >/tmp/tailscaled.log 2>&1 &
  log "tailscaled started (pid $!, userspace-networking)"
  sleep 1
  tailscale up --authkey="${TAILSCALE_AUTHKEY}" --hostname=cf-demo-container --accept-dns=false \
    >/tmp/tailscale-up.log 2>&1 \
    && log "tailscale up succeeded" \
    || log "WARN: tailscale up failed, see /tmp/tailscale-up.log"
else
  log "TAILSCALE_AUTHKEY未設定のため、tailscaledは起動しない"
fi

# --- SSHログインシェルからもcfコマンドの認証情報を読めるようにする ---
# sshdのセッションはこのプロセスの環境変数を引き継がないため書き出す。
umask 077
{
  printf 'export CF_CONTAINER_API_TOKEN=%q\n' "${CF_CONTAINER_API_TOKEN:-}"
  printf 'export CLOUDFLARE_ACCOUNT_ID=%q\n' "${CLOUDFLARE_ACCOUNT_ID:-}"
} > /etc/profile.d/cf-env.sh
umask 022
log "cf env written to /etc/profile.d/cf-env.sh"

log "exec: $*"
exec "$@"
