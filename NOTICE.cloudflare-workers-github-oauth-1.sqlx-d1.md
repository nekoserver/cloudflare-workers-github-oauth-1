# NOTICE: sqlx(sqlx-d1)をこの環境でRust/WASM Workerとして使う手順

**追記(切り出し後)**: `rust-worker-sqlx-d1/` は別リポジトリ
[`nekoserver/rust-worker-sqlx-d1`](https://github.com/nekoserver/rust-worker-sqlx-d1)
に切り出し済み。以下のビルド回避策は今後そちらのリポジトリで作業する際にも有効。

**対象**: `rust-worker-sqlx-d1/`（本体Workerとは別のRustネイティブCloudflare Worker）。
`sqlx`本体はwasm32では動かない(tokioがOSソケットを要求するmio依存でビルド不可)ため、
D1専用の`sqlx-d1`クレート(`ohkami-rs/sqlx-d1`)を使う。これは`workers-rs`(`worker`クレート)
前提であり、本体の Hono+TypeScript Worker とは実行モデルが別になる。

## 1. 検証済みの事実

- 素の`sqlx`(sqlite/postgres/mysql, `runtime-tokio`等)はwasm32-unknown-unknownでビルド不可。
  `mio`クレートがOSソケットAPI(`reregister`/`deregister`等)を要求し、wasm32には存在しないため
  コンパイルエラーになる。**この結果は実際にビルドして確認済み**(推測ではない)。
- `sqlx-d1`(D1専用の互換レイヤー)は**実際にwasm32ビルド・`worker-build`によるパッケージングまで成功**した。
  ただし`worker`クレートのバージョンを`sqlx-d1`が期待するものに合わせる必要がある
  (2026-09時点: `sqlx-d1 0.1.5` は `worker 0.5.x` を要求。`worker 0.6`系を指定すると
  `D1Database`の型が別クレートバージョン扱いになり型エラーになる)。

## 2. Cargo.tomlの必須設定

```toml
[dependencies]
worker = { version = "0.5", features = ["d1"] }   # "d1" featureが無いとenv.d1()が生えない
sqlx-d1 = { version = "0.1", features = ["derive"] }  # FromRowを使うなら"derive"必須
```

- `sqlx_d1::query!`マクロ(コンパイル時SQL検証)を使う場合は`features = ["macros"]`が必要だが、
  ローカルのminiflare D1エミュレータ(`.wrangler/state/v3/d1/...`)か`.sqlx`オフラインキャッシュが
  無いと**`cargo build`自体が失敗する**。この環境では両方とも用意できないため、
  `rust-worker-sqlx-d1/src/lib.rs`では非マクロ版の`sqlx_d1::query_as()`(実行時API、
  コンパイル時DB接続不要)を使っている。

## 3. `worker-build`実行時、外部バイナリの自動ダウンロードがこの環境ではブロックされる

`worker-build`はデフォルトで以下を自動ダウンロードしようとするが、**この環境のプロキシ経由の
生TLS接続では`invalid peer certificate: UnknownIssuer`で失敗する**(GitHub Releases・npm registryの
tarball直接ダウンロード):

- `wasm-bindgen`本体(GitHub Releasesからバイナリ取得)
- `wasm-opt`(binaryen、GitHub Releases)
- `esbuild`(npm registryから直接tarball取得。`npm install`経由ではなく`worker-build`が
  独自にfetchする)

### 回避策(すべて確認済み)

1. **`wasm-bindgen`**: `cargo install wasm-bindgen-cli --version <X>`でインストールし、
   `WASM_BINDGEN_BIN=$(which wasm-bindgen)`環境変数で`worker-build`に渡す。
   **バージョンはCargo.lockが解決した`wasm-bindgen`(Rust側)のバージョンと完全一致させること**
   (不一致だと`rust Wasm file schema version`エラー)。`cargo tree | grep wasm-bindgen`か、
   一度ビルドを試してエラーメッセージに出るバージョン番号を見て決める。
2. **`wasm-opt`**: 最適化ステップなので丸ごと無効化してよい。
   ```toml
   [package.metadata.wasm-pack.profile.release]
   wasm-opt = false
   ```
3. **`esbuild`**: `npm install -g esbuild`(npmはプロキシ経由で正常に通る)でインストールし、
   `ESBUILD_BIN=$(which esbuild)`環境変数で渡す。

### ビルドコマンド(この環境で実際に成功した完全なコマンド)

```bash
cd rust-worker-sqlx-d1
WASM_BINDGEN_BIN=$(which wasm-bindgen) ESBUILD_BIN=$(which esbuild) worker-build --release
```

### `worker-build`自体のバージョンにも注意

最新の`worker-build`(0.8系)は`worker >= 0.8`を要求し、`worker 0.5`系を使うsqlx-d1とは
噛み合わない(`Unsupported version worker@0.5.0`エラー)。**`cargo install worker-build --version "^0.1"`**
で0.1系(worker 0.5系対応)を使うこと。

## 4. wrangler.tomlの構成

```toml
name = "cloudflare-workers-github-oauth-1-sqlx-d1"
main = "build/worker/shim.mjs"
compatibility_date = "2024-11-17"

[build]
command = "npx --yes worker-build --release"

[[d1_databases]]
binding = "DB"
database_name = "<DATABASE_NAME>"
database_id = "<DATABASE_ID>"
```

`wrangler deploy`（またはローカルの`wrangler dev`）が実行する`[build].command`は
上記の`WASM_BINDGEN_BIN`/`ESBUILD_BIN`環境変数を渡さないため、**この環境以外
(ユーザーのローカル環境)でネットワーク制限が無ければ`worker-build`は素のままで動く**。
この環境固有の制約を回避するための情報であり、ユーザーのローカルマシンでは
おそらく素の`npx worker-build --release`だけで通る(念のためエラーが出たら
このNOTICEの回避策を試す)。

## 5. sqlx-d1の既知の制約(ライブラリ本体の仕様)

- トランザクション未対応(D1自体がまだ対応していないため)
- コネクションプール(`sqlx::Pool`)非対応(tokio前提の実装のため)。
  `&sqlx_d1::D1Connection`が`Executor`を実装しており、`&mut`不要で使い回せる
- `Type`/`Encode`/`Decode`のderiveは無い(必要なら`sqlx`本体を追加依存に入れて使う)

## 6. この機能のデプロイ・DB作成はユーザー側の責務

CLAUDE.md記載の制約どおり、この環境からは`wrangler deploy`も`wrangler d1 create`も
実行できない。`wrangler.toml`の`<DATABASE_NAME>`/`<DATABASE_ID>`はプレースホルダのままなので、
ユーザーのローカル環境で以下を実行してから埋めること:

```bash
wrangler d1 create <お好きなDB名>
```
