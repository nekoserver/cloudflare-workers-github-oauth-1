# SPEC: sqlx(sqlx-d1)を使うRustネイティブWorkerの新設

## 1. sqlx-d1 Rust Workerによる D1 クエリ実装

**対象**: `rust-worker-sqlx-d1/` ディレクトリ一式(`Cargo.toml`・`src/lib.rs`・`wrangler.toml`)
— 本体の Hono + TypeScript Worker(`cloudflare-workers-github-oauth-1`)とは別の、
`workers-rs`(`worker`クレート)ベースのRustネイティブCloudflare Workerを新規に立ち上げ、
D1へのクエリにRustの`sqlx`(の互換レイヤーである`sqlx-d1`)を使えるようにする。

## 2. 背景

「rustのsqlxを使えるようにしてください」という依頼を受けたが、調査の結果:

- 素の`sqlx`(tokioランタイム前提)はwasm32-unknown-unknownでビルド不可(`mio`がOSソケットAPIを
  要求するため)。実際にビルドして失敗することを確認済み。
- D1専用の`sqlx-d1`クレートであれば、`workers-rs`(Cloudflareの公式Rust Worker SDK)を前提に
  wasm32ビルド・`worker-build`によるパッケージングまで成功することを実際に確認した。
- ただし`sqlx-d1`は`worker`クレート(=Worker全体の実行モデル)に依存するため、
  既存のHono+TypeScript製Worker(`src/index.ts`)にそのまま組み込むことはできない。

以上をユーザーに報告した上で、「別のRustネイティブWorkerを新規に作る」方針で合意し、
本Workerを新設した。

## 3. 修正内容

| ファイル | 変更概要 |
|---|---|
| `rust-worker-sqlx-d1/Cargo.toml` | `worker`(`d1` feature)・`sqlx-d1`(`derive` feature)・`serde`/`serde_json`を依存に追加。`wasm-opt`はこの環境の制約により無効化 |
| `rust-worker-sqlx-d1/src/lib.rs` | `GET /ping`(疎通確認)・`GET /commit-log/recent`(`commit_agent_log`テーブルを`sqlx_d1::query_as`で取得しJSON返却する実例)の2エンドポイントを実装 |
| `rust-worker-sqlx-d1/wrangler.toml` | 本体とは別Worker名で新規作成。D1バインディングはプレースホルダ(`<DATABASE_NAME>`/`<DATABASE_ID>`)のまま。ユーザー側で`wrangler d1 create`実行後に埋める |
| `NOTICE.cloudflare-workers-github-oauth-1.sqlx-d1.md` | この環境固有のビルド回避策(`WASM_BINDGEN_BIN`/`ESBUILD_BIN`環境変数、`worker-build`のバージョン固定)をまとめた |

## 4. 動作確認

この環境で以下を実際に実行し、ビルドが最後まで通ることを確認済み:

```bash
cd rust-worker-sqlx-d1
cargo build --release --target wasm32-unknown-unknown   # 型チェック含め成功
WASM_BINDGEN_BIN=$(which wasm-bindgen) ESBUILD_BIN=$(which esbuild) worker-build --release   # JS/WASM成果物の生成まで成功
```

D1への実クエリ実行(`wrangler dev`・`wrangler deploy`)はこの環境では行えない
(CLAUDE.md記載の制約どおり、デプロイ・DB作成はユーザー側の責務)。

## 5. 注意事項

- `sqlx-d1`はトランザクション・コネクションプールに未対応(D1・sqlx-d1自体の制約)。詳細はNOTICEファイル参照。
- `sqlx_d1::query!`マクロ(コンパイル時SQL検証)は、ローカルD1エミュレータか`.sqlx`オフライン
  キャッシュが必要なためこの環境では使えず、本実装では実行時API(`query_as`)を使っている。
  ローカル環境でminiflareのD1エミュレータが動く場合は`query!`マクロへの切り替えを検討してよい。
- デプロイ・`wrangler d1 create`・本番運用はユーザー側で行うこと。
