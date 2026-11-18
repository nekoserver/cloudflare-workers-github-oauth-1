#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
compiler="${RUSTC:-rustc}"
version="$($compiler --version)"
[[ "$version" == 'rustc 1.100.0 '* ]] || { echo "Rust 1.100.0 required; got $version" >&2; exit 1; }
output_dir="$repo_dir/public/rust-1.100-apis"
mkdir -p "$output_dir"
"$compiler" --edition=2024 --crate-type=cdylib --target wasm32-unknown-unknown \
  -C opt-level=z -C panic=abort -C strip=symbols \
  "$repo_dir/wasm/rust-1.100-apis/src/lib.rs" -o "$output_dir/apis.wasm"
cp "$repo_dir/wasm/rust-1.100-apis/src/lib.rs" "$output_dir/source.rs"
echo "Built apis.wasm with $version"
