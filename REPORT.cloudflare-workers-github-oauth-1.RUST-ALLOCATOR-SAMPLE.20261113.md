# Rust 1.100 Allocator API WASM sample

Rust 1.100.0の安定化項目にあるAllocator APIから、`Allocator` / `Global`、`Vec::new_in`、`Box::new_in`を使用する静的WASMデモを追加。ブラウザで要素数を指定するとWASM内でGlobal allocatorを明示したVecを作り、Boxに所有させてchecksumを返す。WASM ABIにはu32だけを渡し、allocatorをJS側へ公開しない。カスタムヒープは実装せず、そのように誤認させる説明も避けた。

公開予定パス: `/rust-allocator-sample/`。ファイルは `public/rust-allocator-sample/`、正本Rustは `wasm/allocator-api-wasm/src/lib.rs`、ビルドは `scripts/build-allocator-api-wasm.sh`。Rust 1.100.0でwasm32-unknown-unknownの実WASMを生成済み。依存クレートなし。

ビルドスクリプトはRust 1.100.0の厳密な版確認を含む。本番配備なし。テスト実行なし。

根拠: [Rust 1.100.0公式リリース](https://blog.rust-lang.org/2026/11/12/Rust-1.100.0/)。
