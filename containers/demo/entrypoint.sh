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
# SSH_HOST_ED25519_KEY_B64(秘密鍵のbase64)があれば、作り直しても同じホスト鍵を使う。
# 無ければ起動のたびに新しい鍵になる。子プロセスへ秘密鍵を渡さないよう、使ったら消す。
if [ -n "${SSH_HOST_ED25519_KEY_B64:-}" ]; then
  host_key=/etc/ssh/ssh_host_ed25519_key
  (umask 077; printf '%s' "$SSH_HOST_ED25519_KEY_B64" | base64 -d > "$host_key") 2>/dev/null
  if host_pub=$(ssh-keygen -y -P '' -f "$host_key" 2>/dev/null) && [ "${host_pub%% *}" = ssh-ed25519 ]; then
    printf '%s\n' "$host_pub" > "$host_key.pub"
    log "ssh host key restored from SSH_HOST_ED25519_KEY_B64"
  else
    rm -f "$host_key" "$host_key.pub"
    log "WARN: SSH_HOST_ED25519_KEY_B64 is not an ed25519 private key; generating a new host key"
  fi
fi
unset SSH_HOST_ED25519_KEY_B64
ssh-keygen -A >/tmp/sshkeygen.log 2>&1 || log "WARN: ssh-keygen -A failed"
mkdir -p /root/.ssh
chmod 700 /root/.ssh
# wrangler.tomlのcontainers.authorized_keysと同じ公開鍵(公開情報のため
# 埋め込みで問題ない)。wrangler containers sshとは別に、nekorootトンネル
# 経由の直接sshでも同じ鍵でログインできるようにする。
cat > /root/.ssh/authorized_keys <<'EOF'
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJM8/iV+DiD+cTQQgadOhHKkTUR+2ldz9ocGxC45sRbD admin
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIC2kQ2c3dcds19h599IEkj45GWerMrzC0AELnKqaOMZc
EOF
# 追加の公開鍵。改行か;で区切る。鍵の行以外は捨てる。
if [ -n "${SSH_AUTHORIZED_KEYS:-}" ]; then
  printf '%s\n' "$SSH_AUTHORIZED_KEYS" | tr ';' '\n' | sed 's/^[[:space:]]*//' \
    | grep -E '^(ssh-(ed25519|rsa)|ecdsa-sha2-|sk-)' >> /root/.ssh/authorized_keys
fi
chmod 600 /root/.ssh/authorized_keys
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
# -D keeps sshd attached to its stderr stream; -e sends events there instead
# of directly to a file. Prefix each event with UTC time in syslog format so
# authentication events retain timestamps and remain parseable by sshguard.
# Create the log privately before the redirect (which otherwise uses umask).
(umask 077; touch /tmp/sshd.log)
chmod 600 /tmp/sshd.log
# The demo image builds OpenSSH into /usr/local; the shared Redmine image keeps APT's sshd.
SSHD_BIN=/usr/sbin/sshd
if [ -x /usr/local/sbin/sshd ]; then SSHD_BIN=/usr/local/sbin/sshd; fi
"$SSHD_BIN" -D -e -p 2222 2> >(
  export TZ=UTC
  while IFS= read -r sshd_line || [ -n "$sshd_line" ]; do
    printf '%(%Y-%m-%dT%H:%M:%SZ)T %s sshd: %s\n' -1 "${HOSTNAME:-localhost}" "$sshd_line"
  done >> /tmp/sshd.log
) &
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
# Rule diagnostics and packet/counter events use separate private log files.
(umask 077; touch /tmp/firewall.log /tmp/nftables.log /tmp/firewall-collector.log)
chmod 600 /tmp/firewall.log /tmp/nftables.log /tmp/firewall-collector.log
# INPUT: ループバック・確立済み/関連・新規(NEW)を許可し、不正(invalid)のみ破棄する。
#   (2026-10-17: 以前はNEWを破棄していたため、WorkerからDurable Object経由で
#    8080へ入る接続まで破棄され、/cf-containersの操作がすべて応答しなくなった)
# FORWARD: 許可。
# IPv6: ループバック以外は受信・転送とも破棄する。ssh・Tailscale・cloudflared・Workerからの
#   8080はすべてIPv4で、IPv6の外向きルートも無い(2026-10-21 /debug/netの実測で確認)。
if command -v nft >/dev/null 2>&1; then
  # Counters count all drops; only kernel logging is rate limited.
  # Replace the table atomically after validating the complete transaction.
  nft_file=$(mktemp /tmp/nekoroot-firewall.XXXXXX)
  if nft list table inet filter >/dev/null 2>&1; then
    echo 'delete table inet filter' >> "$nft_file"
  fi
  cat >> "$nft_file" <<'NFT'
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
    meta nfproto ipv6 limit rate 10/second burst 20 packets log prefix "nft-drop ipv6 "
    meta nfproto ipv6 drop
    ct state invalid update @drop_src4 { ip saddr counter } counter
    ct state invalid limit rate 10/second burst 20 packets log prefix "nft-drop invalid "
    ct state invalid drop
    ct state established,related,new accept
    meta nfproto ipv4 update @drop_src4 { ip saddr counter } counter
    limit rate 10/second burst 20 packets log prefix "nft-drop policy "
  }
  chain forward {
    type filter hook forward priority 0; policy accept;
    meta nfproto ipv6 update @drop_src6 { ip6 saddr counter } counter drop
  }
}
NFT
  firewall_mode=rate-limited-log
  if ! nft -c -f "$nft_file" >/tmp/nftables.log 2>&1; then
    # Some container kernels lack nft_limit/log. Preserve filtering and counters.
    sed -i '/limit rate/d' "$nft_file"
    firewall_mode=counters-only
    log "WARN: limited logging unsupported; validating firewall counters without logging"
  fi
  if nft -c -f "$nft_file" >>/tmp/nftables.log 2>&1 && nft -f "$nft_file" >>/tmp/nftables.log 2>&1; then
    printf '%s\n' "$firewall_mode" > /run/nekoroot-firewall-mode
    date -u +%FT%TZ > /run/nekoroot-firewall-counter-epoch
    log "nftables applied: $firewall_mode (log limit 10/second, burst 20 packets when supported)"
    TZ=UTC printf '%(%Y-%m-%dT%H:%M:%SZ)T %s firewall: rules applied mode=%s\n' -1 "${HOSTNAME:-localhost}" "$firewall_mode" >> /tmp/firewall.log
  else
    printf '%s\n' failed > /run/nekoroot-firewall-mode
    log "WARN: firewall update failed; previous rules retained (see /tmp/nftables.log)"
    TZ=UTC printf '%(%Y-%m-%dT%H:%M:%SZ)T %s firewall: rule update failed; see /tmp/nftables.log\n' -1 "${HOSTNAME:-localhost}" >> /tmp/firewall.log
  fi
  rm -f "$nft_file"
else
  log "WARN: nft command not found, firewall not applied"
fi

# Persist drop counters even when the container kernel cannot load nft_log or
# nft_limit. The collector also follows kernel events when those are supported.
python3 /app/firewall-log.py >> /tmp/firewall-collector.log 2>&1 &
log "firewall log collector started (pid $!)"

# --- Redmine(SQLite3のDB初期化・マイグレーション) ---
# 本番(Cloudflare Containers)では起動のたびに/opt/redmineの永続化がリセットされる
# 可能性があるため、DBが無ければ毎回ここで作る。bundle installはビルド時済みのため
# ここではdb:migrateのみ実行する(失敗してもApache自体は起動を試みる)。
REDMINE_DB=/opt/redmine/storage/redmine.sqlite3
# /opt/redmineはDockerfile.redmineでビルドしたイメージにだけある(通常のDockerfileには無い)。
if [ -d /opt/redmine ] && [ ! -f "$REDMINE_DB" ]; then
  ( cd /opt/redmine \
    && su -s /bin/sh www-data -c 'PATH=/usr/local/bin:$PATH RAILS_ENV=production bundle exec rake db:migrate' \
      >/tmp/redmine-migrate.log 2>&1 \
    && log "redmine db:migrate done" ) \
    || log "WARN: redmine db:migrate failed, see /tmp/redmine-migrate.log"
  chown www-data:www-data "$REDMINE_DB" 2>/dev/null || true
fi

# --- Reapply reusable container-only SSI setup after installation ---
python3 /usr/local/libexec/container_setup.py \
  && log "container SSI configured" \
  || log "WARN: container SSI setup failed"

# --- lib(SSI): /root/lib を /var/www/html/lib に見せる(apache-lib.conf、管理者だけ) ---
# libはイメージに入れない(container_setup.py・lib-network/README.mdの方針)。コンテナに置かれた /root/lib を、
# Apacheの実行ユーザー(www-data)が /root を通らずに読めるようbind mountする。失敗しても起動は続ける。
if [ -d /root/lib ]; then
  mkdir -p /var/www/html/lib
  if mountpoint -q /var/www/html/lib; then
    log "lib: /var/www/html/lib is already mounted"
  elif mount --bind /root/lib /var/www/html/lib; then
    log "lib: mounted /root/lib on /var/www/html/lib"
  else
    log "WARN: lib: mount --bind /root/lib /var/www/html/lib failed (lib SSI stays unavailable)"
  fi
else
  log "lib: no /root/lib, lib SSI stays unavailable (/root/lib が無い)"
fi

# --- Apache(server.jsへのTLSプロキシ・Redmineは127.0.0.1:8444で内部待ち受け) ---
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
  TAILSCALED_PID=$!
  log "tailscaled started (pid ${TAILSCALED_PID}, userspace-networking)"
  sleep 1
  # tailscale up はバックグラウンドでリトライする(1分間隔で3回、駄目なら tailscaled を停止)。
  # 起動処理は待たせない。管理サーバーは TAILSCALE_LOGIN_SERVER で指定する(未設定は既定)。
  (
    . /usr/local/bin/tailscale-up.sh
    tailscale_up_with_retry
  ) >>/tmp/tailscale-up.log 2>&1 &
  log "tailscale up supervisor started (pid $!)"
else
  log "TAILSCALE_AUTHKEY未設定のため、tailscaledは起動しない"
fi

# --- T3 Code ---
# T3 Codeは127.0.0.1:3773、埋め込み用の中継は127.0.0.1:3774のloopbackだけで待ち受ける。
# 外へ出す入口は、nekorootトンネルのPublic Hostname(接続先 http://127.0.0.1:3774)だけ。
# 起動に失敗しても他のサービスは止めない。落ちたら3秒待って起動し直す(終了のたびにログへ記録する)。
# ペアリングは、コンテナ内で `t3 pair` を実行して作る(コードはログやリポジトリに残さない)。
if command -v t3 >/dev/null 2>&1; then
  mkdir -p /root/t3-workspace
  (
    while true; do
      t3 serve --host 127.0.0.1 --port 3773 --no-browser /root/t3-workspace
      echo "[entrypoint] t3 serve exited (code $?) at $(date -u +%FT%TZ), restarting in 3s"
      sleep 3
    done
  ) >>/tmp/t3.log 2>&1 &
  log "t3 serve supervisor started (pid $!)"
  (
    while true; do
      node /usr/local/libexec/t3-embed-proxy.cjs
      echo "[entrypoint] t3-embed-proxy exited (code $?) at $(date -u +%FT%TZ), restarting in 3s"
      sleep 3
    done
  ) >>/tmp/t3-proxy.log 2>&1 &
  log "t3-embed-proxy supervisor started (pid $!)"
else
  log "WARN: t3コマンドが無いため、T3 Codeは起動しない"
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

# --- lib の復元(/root/lib/claude/ops/restore-claude-host.sh、nekoserver/lib) ---
# libはイメージに入れない。コンテナに置かれた /root/lib の起動処理で、tunnels API・LLM worker・会話observer・
# ストリーム・Claude Code のhookを毎回の起動で戻す。ORIGIN_HMAC_SECRET・MUSE_API_KEY・起動オプション
# LIB_ROUTE_ACCESS_CONTROL は Worker から環境変数で届き、コマンドラインには出さない。Apacheを起動した後に、
# 準備完了を遅らせないよう裏で動かす。失敗しても起動は続ける。
if [ -x /root/lib/claude/ops/restore-claude-host.sh ]; then
  ( /root/lib/claude/ops/restore-claude-host.sh >/tmp/restore-claude-host.log 2>&1 \
      && log "lib: restore-claude-host.sh done (see /tmp/restore-claude-host.log)" \
      || log "WARN: lib: restore-claude-host.sh failed (see /tmp/restore-claude-host.log)" ) &
else
  log "lib: no /root/lib/claude/ops/restore-claude-host.sh, lib services not restored"
fi

log "exec: $*"
exec "$@"
