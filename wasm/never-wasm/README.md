# Rust 1.100 never型 WASMサンプル

公開用ファイルは `public/rust-never-sample/`。静的配信だけで動き、Worker API・認証情報・外部JSライブラリは不要。

- `Result<u32, !>`: 1ビットの個数を計算し、作れないErr値をnever-to-any coercionで処理。
- `Infallible`: Rust 1.100での `!` への別名化を実際の型代入で確認。
- `fn stop() -> !`: 奇数入力でWASMのunreachable命令を実行。JSでRuntimeErrorを捕捉し、同じインスタンスを再使用。無限ループなし。

`!` 自体をWASM ABIへ渡すのではなく、内部Rustの型として使用し、JSとの境界はu32だけにしている。panicもtrapへ接続するが、奇数入力はpanicを経由しない。

## ビルド・検証

Rust 1.100.0とwasm32-unknown-unknownターゲットを導入後、リポジトリルートで:

```sh
./scripts/build-never-wasm.sh
node --test scripts/never-wasm.test.mjs
python3 -m http.server 8000 --directory public
```

`http://localhost:8000/rust-never-sample/` を開く。独自のコンパイラパスはRUSTCで指定できる。Cargo依存・wasm-bindgen・Dockerビルド不要。buildスクリプトはコンパイラ版を確認し、配信用WASMと表示用Rustソースを生成する。

公式仕様: https://blog.rust-lang.org/2026/11/12/Rust-1.100.0/
