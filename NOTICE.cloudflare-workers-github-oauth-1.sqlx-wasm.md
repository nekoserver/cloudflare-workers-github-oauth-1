# sqlx-wasm 機能概要

`sqlx-wasm` は、Rust の SQLx が提供する `QueryBuilder<Postgres>` をブラウザ向け
WebAssembly で動かし、複数行の `INSERT` 文とバインド引数を組み立てるデモ機能である。
アプリでは `/sqlx-wasm` ページから利用できる。

## できること

- テーブル名、列名、複数行の値を JSON で受け取る
- テーブル名と列名が安全な SQL 識別子であることを検証する
- テーブル名と列名を二重引用符で囲み、PostgreSQL の `$1`, `$2`, ... 形式の
  プレースホルダーを持つ複数行 `INSERT` を生成する
- SQL へ値を直接連結せず、実行側でバインドするための値を入力順の JSON 配列として返す
- 入力の編集に合わせて、生成結果または検証エラーをブラウザ上に表示する

たとえば、次の入力を渡す。

```json
{
  "table": "users",
  "columns": ["id", "name"],
  "rows": [[1, "neko"], [2, "saba"]]
}
```

結果は次の形式になる。

```json
{
  "sql": "INSERT INTO \"users\" (\"id\", \"name\") VALUES ($1, $2), ($3, $4)",
  "arguments": [1, "neko", 2, "saba"]
}
```

WASM の公開関数は `sqlx_build_insert(input: string): string` である。成功時は上記の
JSON 文字列、失敗時は `ERROR: ` で始まる文字列を返す。Rust のネイティブテストからは
`build_insert_json` を直接利用できる。

## 入力検証

識別子は ASCII 英字または `_` で始まり、2文字目以降は ASCII 英数字または `_` のみを
許可する。これにより、テーブル名・列名を経由した SQL 断片の注入を拒否する。
さらに次の入力をエラーにする。

- JSON として解析できない入力
- 列が空の入力
- 行が空の入力
- 列数と値の数が一致しない行を含む入力

値は SQL 本文に埋め込まず、`QueryBuilder` の `push_bind` でプレースホルダー化する。
返却する `arguments` は元の JSON の型と値を維持するため、実際にクエリを実行する層が
データベースの列型に合わせてバインドする。

## 実行範囲と制約

このモジュールの責務は、**クエリの組み立てと入力検証だけ**である。次の処理は行わない。

- PostgreSQL や Cloudflare D1 への接続
- 生成した SQL の実行
- トランザクション、コネクションプール、マイグレーション
- データベーススキーマに対するテーブル名、列名、型の検証
- `SELECT`、`UPDATE`、`DELETE` など `INSERT` 以外のクエリ生成

ブラウザには SQLx が通常利用するデータベースソケットと非同期ランタイムがないため、
接続や実行は Worker などのサーバー側で実装する必要がある。また、生成される SQL は
`QueryBuilder<Postgres>` による PostgreSQL 方言であり、D1 向け SQLx 互換レイヤー
`sqlx-d1` とは別の機能である。

## 構成

- `wasm/sqlx-wasm/src/lib.rs`: 入力検証、SQLx によるクエリ生成、WASM 公開関数
- `src/views/sqlxWasm.ts`: 入力フォーム、WASM の動的読み込み、結果表示
- `public/wasm/sqlx.js` / `public/wasm/sqlx_bg.wasm`: 配信用ビルド成果物
- `src/data/wasmModuleRegistry.ts`: WASM モジュール一覧への登録
- `scripts/build-sqlx-wasm.sh`: テスト、wasm32 release ビルド、wasm-bindgen の実行

`sqlx-postgres` はホームディレクトリの `.pgpass` を探索するため `home` クレートに依存するが、
通常の `home` は `wasm32-unknown-unknown` で利用できない。この機能は DB 接続を行わないため、
`wasm/sqlx-wasm/vendor/home-stub` の「常にホームディレクトリなしを返す」ローカルスタブへ
このクレート内だけで差し替えている。

## ビルドとテスト

リポジトリルートで次を実行する。

```bash
npm run wasm:build:sqlx
```

ビルドスクリプトは次を順番に実行する。

1. `cargo test`
2. `wasm32-unknown-unknown` 向け release ビルド
3. `wasm-bindgen --target web` による `public/wasm/sqlx.js` と
   `public/wasm/sqlx_bg.wasm` の生成

事前に Rust の `wasm32-unknown-unknown` ターゲットと、クレートの依存バージョンに一致する
`wasm-bindgen-cli 0.2.127` が必要である。スクリプトは不足またはバージョン不一致を検出すると、
生成を始める前にエラーで終了する。

