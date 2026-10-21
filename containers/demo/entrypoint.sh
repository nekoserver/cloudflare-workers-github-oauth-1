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
# 書き込めない場合(本番でresolv.confが読み取り専用に差し込まれている可能性)はbind mountで
# 上書きする。起動後にランタイムが書き戻す可能性もあるため30秒ごとに確認し直す。
# 結果は/tmp/dns.log(/debug/logsで読める)に残す。
ensure_ipv4_dns() {
  grep -q '^nameserver 1.1.1.1' /etc/resolv.conf 2>/dev/null && return 0
  { printf 'nameserver 1.1.1.1\nnameserver 1.0.0.1\n'; grep -v '^nameserver' /etc/resolv.conf 2>/dev/null; } > /tmp/resolv.conf.new
  if cat /tmp/resolv.conf.new > /etc/resolv.conf 2>>/tmp/dns.log; then
    echo "$(date -u +%FT%TZ) resolv.conf: 書き込みで1.1.1.1に置き換えた" >>/tmp/dns.log
  elif mount --bind /tmp/resolv.conf.new /etc/resolv.conf 2>>/tmp/dns.log; then
    echo "$(date -u +%FT%TZ) resolv.conf: 書き込めないためbind mountで置き換えた" >>/tmp/dns.log
  else
    echo "$(date -u +%FT%TZ) WARN: resolv.confを書き込みでもbind mountでも置き換えられなかった" >>/tmp/dns.log
  fi
  { echo "--- 現在のresolv.conf"; cat /etc/resolv.conf; } >>/tmp/dns.log 2>&1
}
ensure_ipv4_dns
(while sleep 30; do ensure_ipv4_dns; done) &

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
/usr/sbin/sshd -p 2222 -E /tmp/sshd.log &
log "sshd started on 2222 (pid $!)"
# sshguard: sshdのログファイルを監視し、総当たりの送信元をnftablesで遮断する。
if command -v sshguard >/dev/null 2>&1; then
  touch /tmp/sshd.log
  cat > /etc/sshguard/sshguard.conf <<'EOF2'
BACKEND="/usr/libexec/sshguard/sshg-fw-nft-sets"
LOGREADER="LANG=C tail -F -n 0 /tmp/sshd.log"
THRESHOLD=30
BLOCK_TIME=120
DETECTION_TIME=1800
WHITELIST_FILE=/etc/sshguard/whitelist
EOF2
  sshguard >/tmp/sshguard.log 2>&1 &
  log "sshguard started (pid $!)"
fi

# --- ファイアウォール ---
# INPUT: ループバック・確立済み/関連・新規(NEW)を許可し、不正(invalid)のみ破棄する。
#   (2026-10-17: 以前はNEWを破棄していたため、WorkerからDurable Object経由で
#    8080へ入る接続まで破棄され、/cf-containersの操作がすべて応答しなくなった)
# FORWARD: 許可。
# IPv6: ループバック以外は受信・転送とも破棄する。ssh・Tailscale・cloudflared・Workerからの
#   8080はすべてIPv4で、IPv6の外向きルートも無い(2026-10-21 /debug/netの実測で確認)。
if command -v nft >/dev/null 2>&1; then
  # 破棄する前に、送信元(動的セット・要素ごとの件数付き・1日で消える)、ルールの件数、
  # カーネルログ(接頭辞nft-drop、毎秒10件まで)を取る。/debug/netのnftRuleset・dropLogで見る。
  {
    nft list table inet filter >/dev/null 2>&1 && nft delete table inet filter
    nft -f - <<'NFT'
table inet filter {
  set drop_src4 {
    type ipv4_addr
    flags dynamic, timeout
    timeout 1d
    size 65536
  }
  set drop_src6 {
    type ipv6_addr
    flags dynamic, timeout
    timeout 1d
    size 65536
  }
  chain input {
    type filter hook input priority 0; policy drop;
    iif lo accept
    meta nfproto ipv6 update @drop_src6 { ip6 saddr counter } counter
    meta nfproto ipv6 limit rate 10/second log prefix "nft-drop ipv6 "
    meta nfproto ipv6 drop
    ct state invalid update @drop_src4 { ip saddr counter } counter
    ct state invalid limit rate 10/second log prefix "nft-drop invalid "
    ct state invalid drop
    ct state established,related,new accept
    meta nfproto ipv4 update @drop_src4 { ip saddr counter } counter
    limit rate 10/second log prefix "nft-drop policy "
  }
  chain forward {
    type filter hook forward priority 0; policy accept;
    meta nfproto ipv6 counter drop
  }
}
NFT
  } >/tmp/nftables.log 2>&1 \
    && log "nftables INPUT: lo accept, ipv6 log+count+drop, invalid log+count+drop, established/related/new accept, その他 log+count後にpolicy drop / FORWARD: ipv6 drop" \
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
    --state=mem: \
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

# --- dockerd ---
# 起動できない環境でも他のサービスは止めない(状態は/healthのdockerで見る)。
if command -v dockerd >/dev/null 2>&1; then
  dockerd >/tmp/dockerd.log 2>&1 &
  log "dockerd started (pid $!)"
fi

# --- Codex: サンドボックス内のコマンドに外部通信を許可する ---
# 既定ではseccompでsocket/connectが止まり、tunnels.rb・observerが起動しない
# (cf-containerのNOTICE.codex-sandbox-network.md参照)。既存の設定は残し、無い場合だけ追記する。
mkdir -p /root/.codex
if ! grep -q '^\[sandbox_workspace_write\]' /root/.codex/config.toml 2>/dev/null; then
  printf '\n[sandbox_workspace_write]\nnetwork_access = true\n' >> /root/.codex/config.toml
  log "codex: network_access = true を追記"
fi

# --- SSHログインシェルからもcfコマンドの認証情報を読めるようにする ---
# sshdのセッションはこのプロセスの環境変数を引き継がないため書き出す。
umask 077
{
  printf 'export CF_CONTAINER_API_TOKEN=%q\n' "${CF_CONTAINER_API_TOKEN:-}"
  printf 'export CLOUDFLARE_ACCOUNT_ID=%q\n' "${CLOUDFLARE_ACCOUNT_ID:-}"
  # gh(GitHub CLI)用。空のGH_TOKENを書くとghが未ログイン扱いになるので、値があるときだけ書く
  if [ -n "${GH_TOKEN:-}" ]; then printf 'export GH_TOKEN=%q\n' "$GH_TOKEN"; fi
} > /etc/profile.d/cf-env.sh
umask 022
# ログインしない対話シェル(bash -i)でも同じ認証情報を読む
grep -q 'cf-env.sh' /etc/bash.bashrc 2>/dev/null \
  || printf '\n[ -r /etc/profile.d/cf-env.sh ] && . /etc/profile.d/cf-env.sh\n' >> /etc/bash.bashrc
log "cf env written to /etc/profile.d/cf-env.sh"
# git pushなどもGH_TOKENで認証できるよう、gitの認証をghに任せる(値はログに出さない)
if [ -n "${GH_TOKEN:-}" ] && command -v gh >/dev/null 2>&1; then
  gh auth setup-git >/tmp/gh-setup-git.log 2>&1 \
    && log "gh: GH_TOKENあり、git の認証を gh に設定" \
    || log "WARN: gh auth setup-git failed (see /tmp/gh-setup-git.log)"
else
  log "gh: GH_TOKEN未設定(CONTAINER_GH_TOKENを設定すると使える)"
fi

log "exec: $*"
exec "$@"
