# Rust 1.100 never型の静的WASMサンプル

`public/rust-never-sample/` にHTML/CSS/JS/実WASMと表示用Rustソースを作成。ソースの正は `wasm/never-wasm/src/lib.rs`、再生成は `scripts/build-never-wasm.sh`。

Rust 1.100.0 (0ef1bc386 2026-11-09)の公式ツールチェーンでコンパイル。rustup-initは公式SHA256と照合。wasm32-unknown-unknown / no_std / edition 2024 / panic=abort、外部クレートなし。生成WASMは136 bytes。既存WASMは上書きしない。

`Result<u32, !>`、`Infallible`との型一致、`-> !`と分岐のcoercionを実装。奇数入力でWASM unreachableを実行し、JSでRuntimeErrorを捕捉する。無限ループなし。入力はu32範囲の整数に限定、サーバー送信なし。

Nodeの実WASMテスト3件成功: u32境界値と両関数の一致、奇数trapと同じインスタンスの回復、表示ソースとビルド入力の一致。JS/shell構文、git diff --check成功。実Chromeで偶数・奇数・回復、無効入力4種、u32最大値、1440/390px横はみ出しなし、pageerrorなしを確認。画像と検査ハーネスはartifacts/rust-never-sample-20261113/。

手元の静的HTTPサーバーでの検証。本番配備・git push・Dockerビルドは行っていない。公開時の予定パスは `/rust-never-sample/`。既存wranglerのpublic配信設定を使用でき、Worker処理は追加していない。

仕様の根拠: [Rust 1.100公式リリース](https://blog.rust-lang.org/2026/11/12/Rust-1.100.0/)。
