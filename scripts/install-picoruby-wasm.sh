#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
install_dir="${PICORUBY_WASM_DIR:-$repo_root/.vendor/picoruby-wasm}"
repository="${PICORUBY_WASM_REPOSITORY:-https://github.com/picoruby/wasm.git}"
ref="${PICORUBY_WASM_REF:-main}"

for command in git npm; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "error: $command is required to install PicoRuby/wasm" >&2
    exit 1
  fi
done

if [[ -e "$install_dir" && ! -d "$install_dir/.git" ]]; then
  echo "error: $install_dir exists but is not a Git checkout" >&2
  exit 1
fi

if [[ ! -d "$install_dir/.git" ]]; then
  mkdir -p "$(dirname "$install_dir")"
  git clone --filter=blob:none --branch "$ref" --recurse-submodules "$repository" "$install_dir"
else
  git -C "$install_dir" fetch --depth=1 origin "$ref"
  git -C "$install_dir" checkout --detach FETCH_HEAD
  git -C "$install_dir" submodule update --init --recursive
fi

if [[ -f "$install_dir/package-lock.json" ]]; then
  npm --prefix "$install_dir" ci
elif [[ -f "$install_dir/package.json" ]]; then
  npm --prefix "$install_dir" install
else
  echo "error: PicoRuby/wasm checkout does not contain package.json" >&2
  exit 1
fi

echo "PicoRuby/wasm is installed in $install_dir"
