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

最初の対象は読み取り専用の`gh repo view <owner/repo>`である。`gh-wasm`は
リポジトリ名の検証とAPI応答をMarkdownテーブルへ整形する関数を実装済みだが、
公開WASM成果物とアプリへの配線はまだ行っていない。成果物を生成できる環境で
以下を実行した後、既存モジュールと同様にdynamic importで配線する。

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.127
cargo build --release --target wasm32-unknown-unknown --manifest-path wasm/gh-wasm/Cargo.toml
wasm-bindgen --target web --out-dir public/wasm --out-name gh \
  wasm/gh-wasm/target/wasm32-unknown-unknown/release/gh_wasm.wasm
```

書き込み系コマンドは、CSRF対策、権限の明示、確認UI、監査ログを先に設計してから
追加する。任意の`gh api`をそのまま公開すると、意図しない書き込みAPIも呼べるため
許可リスト方式にする。
