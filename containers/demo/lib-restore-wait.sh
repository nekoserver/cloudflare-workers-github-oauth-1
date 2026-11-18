#!/bin/sh
# lib(nekoserver/lib)の復元を、/root/lib が届いてから1回だけ実行する。entrypoint.sh が Apache の起動の後に裏で呼ぶ。
#   usage: lib-restore-wait.sh LIB_DIR WWW_DIR TIMEOUT_SECONDS INTERVAL_SECONDS LOG_FILE
# libはイメージに入れず、コンテナに後から置かれる。2026-11-18 は起動から約2時間後に置かれ、起動時に一度だけ
# 見る作りでは、復元(tunnels API・LLM worker・observer・ストリーム・hook)も bind mount も行われなかった。
# そこで LIB_DIR/claude/ops/restore-claude-host.sh が現れるまで INTERVAL_SECONDS ごとに見て、TIMEOUT_SECONDS で諦める。
# 届いたら、WWW_DIR にまだ何もマウントされていなければ LIB_DIR を bind mount し(失敗しても続ける)、復元を実行する。
# 秘密の値(Workerから届く環境変数)は、環境変数のまま復元へ引き継ぎ、コマンドラインにもログにも出さない。
set -u
if [ "$#" -ne 5 ]; then
  echo "usage: lib-restore-wait.sh LIB_DIR WWW_DIR TIMEOUT_SECONDS INTERVAL_SECONDS LOG_FILE" >&2
  exit 2
fi
lib=$1 www=$2 timeout=$3 interval=$4 logfile=$5
restore=$lib/claude/ops/restore-claude-host.sh
log() { echo "[entrypoint] $*"; }

waited=0
while [ ! -x "$restore" ]; do
  if [ "$waited" -ge "$timeout" ]; then
    log "WARN: lib: no $restore after ${timeout}s, lib services not restored"
    exit 1
  fi
  sleep "$interval"
  waited=$((waited + interval))
done
[ "$waited" -gt 0 ] && log "lib: $lib arrived after ${waited}s"

mkdir -p "$www"
if mountpoint -q "$www"; then
  log "lib: $www is already mounted"
elif mount --bind "$lib" "$www" 2>/dev/null; then
  log "lib: mounted $lib on $www"
else
  log "WARN: lib: mount --bind $lib $www failed (lib SSI stays unavailable)"
fi

if "$restore" >"$logfile" 2>&1; then
  log "lib: restore-claude-host.sh done (see $logfile)"
else
  log "WARN: lib: restore-claude-host.sh failed (see $logfile)"
  exit 1
fi
