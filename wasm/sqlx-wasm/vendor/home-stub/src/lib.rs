//! `home`クレートのwasm32-unknown-unknown向けスタブ。
//!
//! `sqlx-postgres`は`home::home_dir()`を`.pgpass`ファイルの探索(実行環境の
//! ホームディレクトリ配下)にのみ使う(`src/options/pgpass.rs`)。ブラウザ上の
//! WASMにはファイルシステムもホームディレクトリの概念も存在せず、この
//! sqlx-wasmクレートはクエリ文字列の組み立てのみに`sqlx::QueryBuilder`を
//! 使っていて実際の接続・`.pgpass`読み込みは行わないため、常に`None`を返す
//! スタブで置き換えている(本物の`home`クレートはwasm32-unknown-unknownを
//! サポートしておらずコンパイルエラーになる)。`[patch.crates-io]`で
//! `wasm/sqlx-wasm`クレートのビルドにのみ適用され、他のクレート・
//! ネイティブ環境でのcargo testには影響しない。
use std::path::PathBuf;

pub fn home_dir() -> Option<PathBuf> {
    None
}
