#!/bin/bash
# tailscale up を実行し、失敗したら1分間隔で3回リトライする。
# それでも駄目なら tailscaled を停止する(再試行の仕組みは持たない)。
#
# 入力(環境変数):
#   TAILSCALE_AUTHKEY      認証キー(必須)
#   TAILSCALE_LOGIN_SERVER 管理サーバーのURL。未設定なら既定の controlplane.tailscale.com
#   TAILSCALED_PID         停止対象の tailscaled のPID
#   TAILSCALE_UP_LOG       tailscale up の出力先(既定 /tmp/tailscale-up.log)
#   TAILSCALE_UP_INTERVAL  リトライ間隔の秒数(既定 60)
#   TAILSCALE_UP_RETRIES   リトライ回数(既定 3。初回を含めた試行回数は +1)

tailscale_up_with_retry() {
  local retries="${TAILSCALE_UP_RETRIES:-3}"
  local interval="${TAILSCALE_UP_INTERVAL:-60}"
  local log="${TAILSCALE_UP_LOG:-/tmp/tailscale-up.log}"
  local attempt=0
  local login_args=()
  if [ -n "${TAILSCALE_LOGIN_SERVER:-}" ]; then
    login_args=(--login-server="${TAILSCALE_LOGIN_SERVER}")
  fi

  while :; do
    attempt=$((attempt + 1))
    if tailscale up --authkey="${TAILSCALE_AUTHKEY}" --hostname=cf-demo-container --accept-dns=false \
        "${login_args[@]}" >>"$log" 2>&1; then
      echo "[tailscale-up] tailscale up succeeded (attempt ${attempt})"
      return 0
    fi
    echo "[tailscale-up] WARN: tailscale up failed (attempt ${attempt}), see ${log}" | tee -a "$log"
    if [ "$attempt" -gt "$retries" ]; then
      break
    fi
    sleep "$interval"
  done

  echo "[tailscale-up] WARN: tailscale up failed after ${attempt} attempts; stopping tailscaled" | tee -a "$log"
  if [ -n "${TAILSCALED_PID:-}" ]; then
    kill "$TAILSCALED_PID" 2>/dev/null || true
  fi
  return 1
}
