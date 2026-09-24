#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CRATE="$ROOT/wasm/sqlx-wasm"
WASM_BINDGEN_VERSION="0.2.127"

command -v cargo >/dev/null || { echo "cargo is required" >&2; exit 1; }
rustup target list --installed | grep -qx wasm32-unknown-unknown || {
  echo "run: rustup target add wasm32-unknown-unknown" >&2
  exit 1
}
command -v wasm-bindgen >/dev/null || {
  echo "run: cargo install wasm-bindgen-cli --version $WASM_BINDGEN_VERSION" >&2
  exit 1
}
[[ "$(wasm-bindgen --version)" == "wasm-bindgen $WASM_BINDGEN_VERSION" ]] || {
  echo "wasm-bindgen $WASM_BINDGEN_VERSION is required" >&2
  exit 1
}

cargo test --manifest-path "$CRATE/Cargo.toml"
cargo build --release --target wasm32-unknown-unknown --manifest-path "$CRATE/Cargo.toml"
wasm-bindgen --target web --out-dir "$ROOT/public/wasm" --out-name sqlx \
  "$CRATE/target/wasm32-unknown-unknown/release/sqlx_wasm.wasm"
