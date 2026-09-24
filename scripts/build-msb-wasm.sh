#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
crate_dir="$repo_root/wasm/msb-wasm"
out_dir="$repo_root/public/wasm"
bindgen_version="0.2.127"

if ! rustup target list --installed | grep -qx 'wasm32-unknown-unknown'; then
  echo 'error: wasm32-unknown-unknown is not installed (run: rustup target add wasm32-unknown-unknown)' >&2
  exit 1
fi
if ! command -v wasm-bindgen >/dev/null 2>&1; then
  echo "error: wasm-bindgen-cli ${bindgen_version} is required (run: cargo install wasm-bindgen-cli --version ${bindgen_version} --locked)" >&2
  exit 1
fi
installed_version="$(wasm-bindgen --version | awk '{print $2}')"
if [[ "$installed_version" != "$bindgen_version" ]]; then
  echo "error: wasm-bindgen ${bindgen_version} is required, found ${installed_version}" >&2
  exit 1
fi

cargo test --locked --manifest-path "$crate_dir/Cargo.toml"
cargo build --release --locked --target wasm32-unknown-unknown --manifest-path "$crate_dir/Cargo.toml"
mkdir -p "$out_dir"
wasm-bindgen \
  --target web \
  --out-dir "$out_dir" \
  --out-name msb \
  "$crate_dir/target/wasm32-unknown-unknown/release/msb_wasm.wasm"

echo "generated public/wasm/msb.js and public/wasm/msb_bg.wasm"
