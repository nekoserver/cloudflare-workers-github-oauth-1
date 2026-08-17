# wasm/

ブラウザ側で実行するWASMモジュールのRustソース置き場。

各サブディレクトリ(例: `sha256-wasm/`)が1つのRustクレート(cdylib)で、
ビルド成果物は `public/wasm/` に配置してWorkerの静的アセット(`assets.directory = ./public`)
として配信する。

## ビルド手順(sha256-wasmの例)

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.127
cd wasm/sha256-wasm
cargo build --release --target wasm32-unknown-unknown
wasm-bindgen --target web --out-dir ../../public/wasm --out-name sha256 \
  target/wasm32-unknown-unknown/release/sha256_wasm.wasm
```

`wasm-bindgen-cli` のバージョンは各クレートの `Cargo.toml` の `wasm-bindgen`
依存バージョンと一致させること(不一致だとJSグルーコード生成時にエラーになる)。

## 新しいWASMモジュールを追加する場合

1. `wasm/<crate-name>/` にRustクレートを作成(`crate-type = ["cdylib"]`)
2. 上記手順でビルドし、`public/wasm/<name>.js` + `<name>_bg.wasm` を生成
3. 該当ページの `<script type="module">` から `import('/wasm/<name>.js')` で動的読み込み
   (トップレベル `import` は使わずdynamic importにすること。`<script type="module">` 自体は必須)
4. `public/wasm/` の生成物はビルド成果物なのでリポジトリにコミットする
   (Cloudflare Workersはビルド時にRustコンパイルを行えないため)
