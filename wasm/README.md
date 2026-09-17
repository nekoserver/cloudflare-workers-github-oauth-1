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

## サーバー側(Worker)からも同じWASMを実行する場合

`--target web` のwasm-bindgen出力は `initSync(module)` を公開しており、
`module` に `WebAssembly.Module` を直接渡せば `fetch` を介さず同期的に
初期化できる。Cloudflare Workers/wranglerは `.wasm` ファイルを直接ESモジュール
としてimportでき、そのデフォルトエクスポートが `WebAssembly.Module` になる
ため、`public/wasm/` のビルド成果物をブラウザ・サーバー(Worker)の両方で
そのまま再利用できる(ビルドは1回でよい)。

例(`src/utils/sha256WasmServer.ts`):

```ts
import { initSync, sha256_hex } from '../../public/wasm/sha256.js';
import sha256WasmModule from '../../public/wasm/sha256_bg.wasm';

let initialized = false;
export function sha256HexViaWasm(input: string): string {
  if (!initialized) {
    initSync(sha256WasmModule);
    initialized = true;
  }
  return sha256_hex(input);
}
```

注意: `.wasm` の静的importを含むファイルは、Vite/vitest環境では
`.wasm` インポートが `WebAssembly.Module` ではなくアセットパス文字列に
なるため、そのままではテスト実行時にエラーになる。`index.ts` から
呼び出す側は **dynamic import(`await import(...)`)** にして、実際に
その機能が呼ばれるまで読み込みを遅延させること(`app from './index'`
を読み込む既存の全テストが静的importのせいで壊れるのを防ぐため)。
また `.wasm` importをTypeScriptで解決できるよう `src/wasm-module.d.ts`
のようなアンビエント宣言(`declare module '*.wasm'`)が必要。

## 導入済みモジュール一覧

Jev CLIについては、既存CLIを丸ごと移植するのではなく、入力検証・APIペイロード構築・
レスポンス整形だけを候補にする実現可能性調査を
[`SPEC.cloudflare-workers-github-oauth-1.jev-cli-wasm.md`](../SPEC.cloudflare-workers-github-oauth-1.jev-cli-wasm.md)
に記載している。Jev APIキーとHTTP通信はWorker側に残す方針で、現時点では
`jev-wasm`モジュールは未実装である。

- `sha256-wasm`: SHA-256計算(`sha2` crate)。`/sha256-wasm`ページ・`/neko 256`
- `factor-wasm`: GNU coreutils `factor` を模した素因数分解(試し割り法、
  0以上2^53以下の整数のみ対応)。`/factor-wasm`ページ・`/neko factor`。
  C言語コード生成を伴わない純Rust実装のため、tree-sitter系クレートで
  ぶつかったwasm32ビルド不可の制約は関係ない(NOTICE.cloudflare-workers-github-oauth-1.rust-WASM.md参照)
- `dig-wasm`: dig(1)風のDNS問い合わせ。DNSワイヤーフォーマットの問い合わせ
  パケット組み立て・応答パケット解析(A/AAAA/NS/CNAME/MX/TXT/SOA等)をRustで
  実装。`/neko dig <ドメイン> [タイプ]`(`/neko dig --help`でヘルプ表示)。
  ブラウザページは無くサーバー(Worker)実行のみ。Workersからは生のUDP:53
  ソケットが使えないため、実際のDNS問い合わせ自体はCloudflare DNS over
  HTTPS(`https://cloudflare-dns.com/dns-query`)へのfetchで行う
  (`src/utils/digWasmServer.ts`)
- `ls-wasm`: GNU coreutilsの`ls`コマンドの出力書式(短形式/`-l`長形式/`-a`全件表示)
  だけをRustで再実装したもの(実ファイルを読むわけではない)。Workersには
  ファイルシステムの一覧取得API相当が無いため、一覧対象はJS側(`src/utils/lsWasmServer.ts`)
  が`WASM_MODULE_REGISTRY`自体を仮想ディレクトリとして渡す
  (`"name\ttype\tsize\tmtime"`形式のTSVをls-wasmへ渡し、整形済みテキストを受け取る)。
  `/neko ls [-l] [-a]`。ブラウザページは無くサーバー(Worker)実行のみ
- `tree-wasm`: GitHub Trees APIの`path`・`type`一覧を受け取り、リポジトリの
  ディレクトリ構造を罫線文字を使わないMarkdown入れ子リストへ整形するRust実装。
  名前順ソート、表示深さ、隠しパス除外に対応する。ネットワークアクセスやOAuthは
  WASMに持ち込まずWorker側が担当する。`/neko tree <owner/repo>`で既定2階層、
  `--depth 1`から`--depth 4`で表示階層を指定する。`--pattern '*.ts'`で名前を
  glob絞り込み、`--files-only`/`--dirs-only`で種別を限定できる。`--hidden`で
  隠しパスを含め、`--sort name|time`と`--reverse`で順序を変更する。時刻順は
  3列目にUnixミリ秒の時刻が渡された場合に利用できる。
  Worker側はユーザーのGitHub OAuthトークンでTrees APIを取得する。WASM生成物を
  リポジトリへ含めるまでは、`src/utils/treeWasmServer.ts`の互換アダプターが
  `tree_format`と同じTSV契約・出力規則を提供し、未生成ファイルのimportでWorker全体を
  ビルド不能にしない。両実装の同一性はRust/TypeScript双方のテストで固定する
- `gh-wasm`: `gh pr list <owner/repo>`相当。GitHub REST APIのプルリクエスト
  一覧JSONをMarkdownテーブルへ整形する(`format_pr_list`)。実際のfetchは
  `src/index.ts`の`fetchAndFormatGhPrList`がユーザーのOAuthトークンで行う。
  `/neko gh pr list <owner/repo>`・`GET /api/gh/pr-list?repo=<owner/repo>`。
  ブラウザページは無くサーバー(Worker)実行のみ。同クレート内の
  `gh repo view`相当(`format_repo_view`)は配線未実施のプロトタイプのまま
- `sqlc-wasm`: sqlc(https://sqlc.dev/)の`-- name: GetAuthor :one`形式の
  クエリアノテーションをパースし、名前・コマンド種別・行番号・SQL本文を
  Markdownテーブルへ整形する(`parseQueryAnnotations`・`formatResultMarkdown`)。
  gh-attach-wasmと同じくGo/js-wasm移植(下記「sqlc-wasm移植プロトタイプ」節参照)。
  `/sqlc-wasm`ページのブラウザ実行のみでサーバー(`/neko`等)からは呼ばれない

新しいモジュールを追加したら、`src/data/wasmModuleRegistry.ts` の
`WASM_MODULE_REGISTRY`(`/wasm-modules`ページの一覧・起動時ON/OFF設定用)
にもエントリを追加すること。

## gh-wasm移植プロトタイプ

`gh-wasm/`には、Go製GitHub CLIをWorkers向けに移植できるか検証する最小の
Rust実装がある。完全な`gh`はGit、端末、OSキーチェーン、対話UIに依存するため
ブラウザ/Workers向けWASMへそのまま移植せず、次の境界で段階的に実装する。

| 担当 | 処理 |
|---|---|
| Rust/WASM | `owner/repo`の検証、GitHub API応答の整形、コマンド固有ロジック |
| Worker/JavaScript | OAuthトークン管理、`fetch`によるGitHub API通信、HTTPエラー処理 |

最初の対象は読み取り専用の`gh repo view <owner/repo>`(`validate_repo`・
`format_repo_view`、ブラウザ/アプリへの配線は未実施のプロトタイプのまま)と、
`gh pr list <owner/repo>`(`format_pr_list`)。後者は実際にビルド・配線済みで、
`/neko gh pr list <owner/repo>`(AIチャットのスラッシュコマンド)と
`GET /api/gh/pr-list?repo=<owner/repo>`から呼び出せる
(`src/utils/ghWasmServer.ts`がinitSyncでロードし、`src/index.ts`の
`fetchAndFormatGhPrList`がGitHub REST API `GET /repos/{owner}/{repo}/pulls`を
ユーザーのOAuthトークンでfetchしてから`format_pr_list`へ渡す)。

`format_pr_list`は`serde_json`でGitHub APIレスポンス(PR配列のJSON文字列)を
パースし、番号・タイトル・作成者・状態(draftの場合は"draft")・URLの
Markdownテーブルへ整形する。CLAUDE.mdルール16(罫線・ツリー文字禁止)に
従いMarkdownテーブルで表現し、セル内の`|`・改行はエスケープする。

ビルド手順(`gh repo view`側の配線が今後必要になった場合も同じ手順):

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.127
cd wasm/gh-wasm && cargo test                     # ネイティブ環境でロジック部分を検証
cargo build --release --target wasm32-unknown-unknown --manifest-path wasm/gh-wasm/Cargo.toml
wasm-bindgen --target web --out-dir public/wasm --out-name gh \
  wasm/gh-wasm/target/wasm32-unknown-unknown/release/gh_wasm.wasm
```

書き込み系コマンドは、CSRF対策、権限の明示、確認UI、監査ログを先に設計してから
追加する。任意の`gh api`をそのまま公開すると、意図しない書き込みAPIも呼べるため
許可リスト方式にする。

## gh-attach-wasm(Go/js-wasm移植、`/gh-attach`ページで導入済み)

`gh-attach-wasm/`は、上記gh-wasmとは別に、`gh issue create --attach`
(cli/cli `internal/attachments`)が行うMarkdown組み立てロジックをGo製の
まま(Rustへの書き直しなし)js/wasmターゲットへ移植したもの。RustのWASM
モジュール群とは生成物の形式が異なる(wasm-bindgenの`initSync`ではなく、
Go標準の`wasm_exec.js`グルーコード経由で`GOOS=js GOARCH=wasm`バイナリを実行する)。

移植範囲は、実ファイルI/O(`os.Open`)とHTTP送信(`net/http`)を除いた
「本文Markdown中の`![alt](filename)`参照を書き換え、未参照の添付は末尾に
追記する」という純粋な文字列組み立て部分のみ(`markdown.go`)。実際の
アップロード・Issue作成はCloudflare Workers側(`src/index.ts`の
`/api/gh-attach/upload`・`/api/gh-attach/create-issue`)がユーザーの
既存GitHub OAuthセッションのアクセストークンで行う。

cli/cli本家の`references.go`(goldmarkベースの本格的なMarkdownパーサー、
810行)は移植範囲に含めていない。ここでの参照検出は`![alt](filename)`と
一致する正規表現による簡易実装であり、ネストした画像リンクや
コードブロック内の見せかけの参照など、goldmark実装が正しく除外する
エッジケースは扱わない(`markdown.go`冒頭のコメント参照)。

### ビルド手順

```bash
cd wasm/gh-attach-wasm
go test ./...                                    # ネイティブ環境でロジック部分を検証
GOOS=js GOARCH=wasm go build -o ../../public/wasm/gh-attach.wasm .
cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" ../../public/wasm/gh-attach-wasm_exec.js
```

Rust版と異なり`wasm-bindgen`は使わない(Goの`js/wasm`ターゲットは標準ツール
チェーンに同梱されており、追加のcrates.io/npmパッケージ取得が不要なため、
このリポジトリのネットワークプロキシ制約(`wasm32-unknown-unknown`の
std取得が拒否される問題、NOTICE.cloudflare-workers-github-oauth-1.rust-WASM.md
参照)を受けない)。`public/wasm/gh-attach.wasm`と
`public/wasm/gh-attach-wasm_exec.js`はビルド成果物なのでリポジトリに
コミットする。

### ブラウザ側の読み込み

```js
await import('/wasm/gh-attach-wasm_exec.js'); // globalThis.Go を定義
const go = new Go();
const result = await WebAssembly.instantiateStreaming(fetch('/wasm/gh-attach.wasm'), go.importObject);
go.run(result.instance); // ここでglobalThis.ghAttachBuildMarkdownが登録される
const markdown = ghAttachBuildMarkdown(JSON.stringify({ body, attachments }));
```

`go.run(...)`が返すPromiseはGoの`main()`が終了するまで解決しない
(`main_js.go`は`select {}`でブロックし続ける設計のため、意図的に待たない)。

### 実アップロード先(uploads.github.com)はclassic PATでないと動かない

`/gh-attach`ページ自体のMarkdown組み立て(このWASM)とは別に、実際の画像
アップロードは`src/index.ts`の`POST /api/gh-attach/upload`がTypeScript側で
`https://uploads.github.com/user-attachments/assets`へ`fetch`している。
このエンドポイントはトークンの種類で挙動が変わることが実機で確認できた:
GitHub Appのuser-to-serverトークン(`ghu_`)は404、fine-grained PATは403
(`Resource not accessible by personal access token`)、**classic PAT
(`ghp_`、`repo`スコープ)のみ成功**する。このため`GH_ATTACH_UPLOAD_TOKEN`
という専用のclassic PATを別途`wrangler secret put`で設定する必要がある
(詳細は`NOTICE.cloudflare-workers-github-oauth-1.20260902.md`参照)。

## sqlc-wasm移植プロトタイプ

`sqlc-wasm/`は、Go製のSQLコード生成ツール[sqlc](https://sqlc.dev/)を
Workers/ブラウザ向けに移植できるか検証するプロトタイプ。sqlc本体は
PostgreSQL/MySQL/SQLite向けのSQL構文解析器、スキーマとの型突き合わせ、
Goの構造体・クエリ関数のコード生成までを行う大規模なツールであり、
そのままブラウザWASMへ移植する対象ではない。

移植範囲は、sqlcのクエリファイルが使う「クエリアノテーション」構文
(`-- name: GetAuthor :one` のようなコメント行で、SQL文1つ1つに名前と
コマンド種別を付与する。sqlcの`internal/metadata`パッケージが定義する
仕様)を検出・検証するテキスト処理部分のみ(`annotations.go`)。

| 担当 | 処理 |
|---|---|
| Go/WASM(`sqlc-wasm`) | アノテーション行の検出、クエリ名・コマンド種別の妥当性検証、SQL本文の抽出、Markdownテーブルへの整形 |
| (対象外) | SQL構文解析(PostgreSQL/MySQL/SQLite文法)、スキーマとの型突き合わせ、Goコード生成 |

対応コマンド種別: `one`, `many`, `exec`, `execrows`, `execlastid`,
`execresult`, `batchexec`, `batchmany`, `batchone`, `copyfrom`
(https://docs.sqlc.dev/en/latest/reference/query-annotations.html)。

gh-attach-wasmと同じ理由(`wasm32-unknown-unknown`のC言語コード生成を
含むクレートがビルドできないというRust側の制約を受けない)でGo標準の
`GOOS=js GOARCH=wasm`ターゲット・`wasm_exec.js`グルーコードを使う。

### ビルド手順

```bash
cd wasm/sqlc-wasm
go test ./...                                    # ネイティブ環境でロジック部分を検証
GOOS=js GOARCH=wasm go build -o ../../public/wasm/sqlc.wasm .
cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" ../../public/wasm/sqlc-wasm_exec.js
```

`public/wasm/sqlc.wasm`と`public/wasm/sqlc-wasm_exec.js`はビルド成果物
なのでリポジトリにコミットする。

### ブラウザ側の読み込み

```js
await import('/wasm/sqlc-wasm_exec.js'); // globalThis.Go を定義
const go = new Go();
const result = await WebAssembly.instantiateStreaming(fetch('/wasm/sqlc.wasm'), go.importObject);
go.run(result.instance); // ここでglobalThis.sqlcParseQueryAnnotationsが登録される
const markdown = sqlcParseQueryAnnotations(sqlText); // Markdownテーブル文字列を返す
```

### 今後の拡張余地

`sqlc generate`本体(SQL構文解析・型突き合わせ・コード生成)は、
PostgreSQL/MySQL/SQLite文法のパーサーが必要でこのプロトタイプの範囲を
大きく超えるため未着手。将来必要になった場合は、公式が構文解析器の
WASMビルドを配布していないか先に確認すること
(`NOTICE.cloudflare-workers-github-oauth-1.rust-WASM.md`の教訓と同じ)。
