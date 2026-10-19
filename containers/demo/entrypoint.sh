#!/bin/sh
set -eu

child_pid=""
sync_pid=""
persistence_enabled=false

r2_path() {
  if [ -n "${R2_PREFIX:-}" ]; then
    printf 'r2:%s/%s' "$R2_BUCKET_NAME" "$R2_PREFIX"
  else
    printf 'r2:%s' "$R2_BUCKET_NAME"
  fi
}

upload_workspace() {
  echo "Saving /workspace to R2" >&2
  rclone sync /workspace "$(r2_path)" --create-empty-src-dirs
}

cleanup() {
  if [ -n "$sync_pid" ]; then
    kill "$sync_pid" 2>/dev/null || true
    wait "$sync_pid" 2>/dev/null || true
    sync_pid=""
  fi
  if [ -n "$child_pid" ]; then
    kill -TERM "$child_pid" 2>/dev/null || true
    wait "$child_pid" 2>/dev/null || true
    child_pid=""
  fi
  if [ "$persistence_enabled" = true ]; then
    upload_workspace || echo "Final R2 save failed" >&2
  fi
}
trap cleanup EXIT INT TERM

r2_values="${R2_ACCOUNT_ID:-}${R2_BUCKET_NAME:-}${AWS_ACCESS_KEY_ID:-}${AWS_SECRET_ACCESS_KEY:-}"
if [ -n "$r2_values" ]; then
  : "${R2_ACCOUNT_ID:?R2_ACCOUNT_ID is required when R2 persistence is enabled}"
  : "${R2_BUCKET_NAME:?R2_BUCKET_NAME is required when R2 persistence is enabled}"
  : "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required when R2 persistence is enabled}"
  : "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required when R2 persistence is enabled}"

  R2_SYNC_INTERVAL=${R2_SYNC_INTERVAL:-300}
  case "$R2_SYNC_INTERVAL" in
    *[!0-9]*|'') echo "R2_SYNC_INTERVAL must be an integer" >&2; exit 1 ;;
  esac
  if [ "$R2_SYNC_INTERVAL" -lt 10 ]; then
    echo "R2_SYNC_INTERVAL must be at least 10 seconds" >&2
    exit 1
  fi

  export RCLONE_CONFIG_R2_TYPE=s3
  export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
  export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
  export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
  export RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
  export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true

  echo "Restoring /workspace from R2" >&2
  rclone copy "$(r2_path)" /workspace --create-empty-src-dirs
  persistence_enabled=true

  (
    while sleep "$R2_SYNC_INTERVAL"; do
      upload_workspace || echo "Periodic R2 save failed" >&2
    done
  ) &
  sync_pid=$!
else
  echo "R2 persistence is disabled; /workspace is ephemeral" >&2
fi

"$@" &
child_pid=$!
status=0
wait "$child_pid" || status=$?
child_pid=""
exit "$status"
