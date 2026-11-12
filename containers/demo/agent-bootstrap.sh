#!/bin/bash
# 起動時の初期セットアップ。外から置かれた状態ファイルからCodexのサインインを復元する。
# 状態ファイルが無いときは何もしない(起動は止めない)。失敗は記録して非0で終わる。
#
# 入力:
#   AGENT_STATE_DIR       状態ファイルの置き場所(既定 /var/lib/agent-state)
#                         codex-auth.json があれば ~/.codex/auth.json へ復元する
#   AGENT_BOOTSTRAP_LOG   ログの出力先(既定 /tmp/agent-bootstrap.log)
# 秘密情報の値は、ログにも標準出力にも出さない。

agent_bootstrap_log() {
  local log="${AGENT_BOOTSTRAP_LOG:-/tmp/agent-bootstrap.log}"
  echo "$(date -u +%FT%TZ) [agent-bootstrap] $*" | tee -a "$log"
}

agent_bootstrap_restore_codex_auth() {
  local state="${AGENT_STATE_DIR:-/var/lib/agent-state}"
  local src="${state}/codex-auth.json"
  local dest="${HOME}/.codex/auth.json"

  if [ ! -f "$src" ]; then
    agent_bootstrap_log "SKIP codex-auth.json が無いため復元しない(${src})"
    return 0
  fi
  if [ -f "$dest" ]; then
    agent_bootstrap_log "SKIP ${dest} が既にあるため上書きしない"
    return 0
  fi
  if ! python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$src" 2>/dev/null; then
    agent_bootstrap_log "FAIL codex-auth.json がJSONとして読めないため復元しない"
    return 1
  fi
  mkdir -p "$(dirname "$dest")"
  if ( umask 077; cp "$src" "$dest" ) && chmod 600 "$dest"; then
    agent_bootstrap_log "OK codex-auth.json を ${dest} へ復元した"
    return 0
  fi
  agent_bootstrap_log "FAIL codex-auth.json の復元に失敗した"
  rm -f "$dest"
  return 1
}

agent_bootstrap() {
  local failed=0
  agent_bootstrap_restore_codex_auth || failed=1
  return "$failed"
}
