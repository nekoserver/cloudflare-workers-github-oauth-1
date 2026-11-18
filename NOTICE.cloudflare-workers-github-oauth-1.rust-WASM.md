# NOTICE: Rust/WASM実装まとめ

**対象**: このリポジトリでRustをWASM化してWorker/ブラウザ上で実行する一連の実装(`/sha256-wasm`、`/neko 256`、`/wasm-modules`、`/file-deps`)で得た知見・落とし穴・忘れると損する手順をまとめる。今後同様のRust/WASM機能を追加するときに最初に読むこと。

## モジュール一覧と数え方（2026-11-13）

本体の自前Rustクレートは9件。次表のCLI版は今回の隔離検証で生成に使用した版、バイナリの有無はローカルcheckoutの`public/wasm/`を対象とする。本番Workerのアップロード数・現在の配信内容を表すものではない。

| クレート | 主な処理 | 検証時CLI | 保存済みバイナリ |
|---|---|---|---|
| `dig-wasm` | DNSパケット生成・解析（通信はJS側） | 0.2.127 | `dig_bg.wasm` |
| `factor-wasm` | 素因数分解 | 0.2.127 | `factor_bg.wasm` |
| `gh-wasm` | GitHubリポジトリ検証・PR等の整形 | 0.2.127 | `gh_bg.wasm` |
| `jev-wasm` | 評価計画・API要求生成・応答解析 | 0.2.128 | `jev_bg.wasm` |
| `ls-wasm` | 仮想一覧の整形 | 0.2.127 | `ls_bg.wasm` |
| `msb-wasm` | コマンドヘルプ・ツリー表示 | 0.2.128 | `msb_bg.wasm` |
| `sha256-wasm` | SHA-256計算 | 0.2.127 | `sha256_bg.wasm` |
| `sqlx-wasm` | INSERT文・パラメータの生成 | 0.2.127 | `sqlx_bg.wasm` |
| `tree-wasm` | TSV一覧からツリー整形 | 0.2.127 | なし（検証用生成物は別領域） |

保存済み8バイナリのproducersにはrustc **1.94.1**が記録されている。今回のRust 1.100.0による生成物とは区別する。サイズ・SHA256・producersの採取結果は[current-public-wasm.json](artifacts/rust-1.100-20261113/current-public-wasm.json)、CLI生成結果は[bindgen-results.json](artifacts/rust-1.100-20261113/bindgen-results.json)に保存している。

Rust以外では`public/wasm/`にGo製の`go-diff.wasm`・`gh-attach.wasm`・`gron.wasm`・`sqlc.wasm`と対応するGoランタイムJSがある。外部配布のRuby WASM、Tailscale WASM、ast-grep/tree-sitter等も別の依存であり、ルートのRustツールチェーン固定で再生成される対象ではない。Tailscaleの運用は[専用NOTICE](NOTICE.cloudflare-workers-github-oauth-1.muse-status-wasm.20261107.md)を参照する。

「ソースのクレート数」「静的アセットのファイル数」「Workerに同梱するWASMモジュール数」「外部から実行時に取得するWASM」は分けて数える。[2026-09-29の棚卸し](NOTICE.cloudflare-workers-github-oauth-1.cloudflare-wasm-inventory.20260929.md)の8個は当時のWranglerバンドルの実測値であり、現在の個数として転記しない。今回は本番バンドルの再採取をしていない。

## Rust 1.100.0対応で確認したこと

- MSBのロックは0.2.128、旧ビルドスクリプトのCLIは0.2.127で、実生成時のスキーマ不一致を再現。スクリプトを0.2.128へ修正した。
- 本体9クレートのネイティブテストは合計54件成功（factor/sha256は各0件）、全9件のWASM releaseビルド・JS生成が成功。Node・Chrome・workerdで全9モジュールの実関数結果も確認した。
- 別リポジトリの`rust-worker-sqlx-d1`はネイティブ150件、WASM release、workerdの`/ping`を確認。本体の9モジュールには数えない。
- 本体9件と別Workerの計10ロックファイルはハッシュ不変。アプリのRustソース、既存の配信用JS/WASMは変更していない。

以上は保存済みレポート・ログに記録された隔離検証の結果で、今回のNOTICE編集時にコンパイルを再実行した結果ではない。本番デプロイ、認証済み本番画面、実D1問い合わせ、別Workerの公開ビルド工程全体は未検証。再生成時にはJSとWASMを必ず同じ生成物の組で扱う。

---

## 1. Rustツールチェーンとビルド条件（2026-11-13更新）

`rust-toolchain.toml`はRust **1.100.0**、`minimal`、`wasm32-unknown-unknown`を指定する。既存クレートのeditionは2021のまま。コンパイラを更新しても、保存済み・本番配信中のWASMが自動で更新されるわけではない。

- 公式のコンパイル済みツールチェーン・CLIを使い、取得物は上流のSHA256と照合する。外部ツールのソースインストールを既定にしない。
- wasm-bindgenの互換条件は**SCHEMA_VERSIONの一致**。通常はCargo.lockのcrate版とCLI版をそろえる。リリース番号だけで非互換とは判断しない（末尾の互換性節を参照）。
- tree/msb/sqlxのビルドスクリプトは、テストとビルドの両方で`--locked`を指定する。依存更新時にはロックとCLI指定を一緒に確認する。
- Cargoの中間成果物配置と、最終cdylibの`target/wasm32-unknown-unknown/release/<crate>.wasm`を区別する。`CARGO_TARGET_DIR`を指定する場合はスクリプトの参照先も別途確認する。
- このコンテナではソースのコンパイル・Dockerビルドを実行しない。以下のビルド例は対応する別環境での手順であり、実行条件は[AGENTS.md](AGENTS.md)・[AGENT.md](AGENT.md)を優先する。過去のネットワーク疎通やビルド成功を、現在の実行許可・環境保証として扱わない。

## 2. 純Rustクレート(Cのコード生成を含まない)はwasm32ビルドが通る

`sha256-wasm`(`wasm/sha256-wasm/`、`sha2`クレート使用)のような、依存が全部Rustで完結するクレートは何の問題もなく `wasm32-unknown-unknown` にビルドできる。

```bash
cd wasm/sha256-wasm
cargo build --release --target wasm32-unknown-unknown
wasm-bindgen --target web --out-dir ../../public/wasm --out-name sha256 \
  target/wasm32-unknown-unknown/release/sha256_wasm.wasm
```

## 3. C言語のコード生成を含むクレートで遭遇した制約（過去の検証）

`tree-sitter-typescript` のような、tree-sitterのパーサーがC言語で生成されているクレートを `wasm32-unknown-unknown` 向けにビルドしようとすると、C toolchain側で失敗する:

```
fatal error: 'stdlib.h' file not found
```

当時の環境にはwasm32向けのCヘッダー一式（WASI SDK等のsysroot）がなく、追加導入も制限されていた。これは当時の構成に対する結果であり、Cを含むすべてのクレートが原理的にWASM化できないという意味ではない。現在の作業では第1節の実行条件に従う。

**この制約により、「ast-grepを自前のRustクレートとして書いてWASM化する」計画は断念した。** tree-sitter文法(パーサー)を自前でwasm32ビルドする必要がある機能は、この環境では実現できない。

### 回避策: 公式のビルド済みWASMパッケージを使う

ast-grep本体もtree-sitter文法も、公式がすでにビルド済みの `.wasm` をnpmで配布している。**自前ビルドせず、それをそのまま使えばよい**:

- `@ast-grep/wasm`(1.8MB) — ast-grep本体(Rust製)のwasm-bindgenビルド済み出力
- `tree-sitter-typescript` — `tree-sitter-typescript.wasm` / `tree-sitter-tsx.wasm` を同梱

```bash
npm install --save-dev @ast-grep/wasm tree-sitter-typescript
```

使い方(概略):

```js
import { initializeTreeSitter, registerDynamicLanguage, parse } from '@ast-grep/wasm';

await initializeTreeSitter();
await registerDynamicLanguage({
  typescript: { libraryPath: '.../node_modules/tree-sitter-typescript/tree-sitter-typescript.wasm' },
});
const root = parse('typescript', sourceCode).root();
const imports = root.findAll({ rule: { kind: 'import_statement' } });
```

**教訓**: 「Rustで書かれたツールをWASM化して使いたい」と思ったら、まず「そのツール自体がすでに公式にWASMビルドを配布していないか」を確認する方が早い。特にC言語のコード生成を伴うクレート(tree-sitter系、正規表現エンジンの一部、暗号ライブラリの一部等)は自前wasm32ビルドがこの環境でブロックされる可能性が高い。

## 4. ブラウザ向けWASM(`--target web`)はサーバー(Worker)側でも同じバイナリを再利用できる

`wasm-bindgen --target web` の出力は `initSync(module)` を公開しており、`module` に `WebAssembly.Module` を直接渡せば `fetch` を介さず同期的に初期化できる。

Cloudflare Workers/wranglerは `.wasm` ファイルを直接ESモジュールとしてimportでき、そのデフォルトエクスポートが `WebAssembly.Module` になる。つまり:

```ts
import { initSync, sha256_hex } from '../../public/wasm/sha256.js';
import sha256WasmModule from '../../public/wasm/sha256_bg.wasm';

let initialized = false;
export function sha256HexViaWasm(input: string): string {
  if (!initialized) { initSync(sha256WasmModule); initialized = true; }
  return sha256_hex(input);
}
```

**ビルドは1回だけ**で、`public/wasm/`配下の成果物をブラウザ(`/sha256-wasm`ページがfetchして実行)とサーバー(Workerがビルド時に同梱して`initSync`で実行、`/neko 256`)の両方で使い回せる。

## 5. `.wasm`の静的importはVite/vitest環境とCloudflare Workers環境で挙動が違う(テストを壊す罠)

- **Cloudflare Workers/wrangler**: `.wasm`をimportすると `WebAssembly.Module` が返る。
- **Vite/vitest**: `.wasm`をimportすると(デフォルト設定では)`WebAssembly.Module`ではなく**アセットパスの文字列**が返る。

このため、`.wasm`を静的importするファイルを `index.ts` から静的importしてしまうと、`import app from './index'` を使う既存の全テスト(数十ファイル)がテスト収集の時点で壊れる。

**対処**: `.wasm`を静的importする実装(`src/utils/sha256WasmServer.ts`)は独立したファイルに切り出し、`index.ts`側では**dynamic import(`await import(...)`)でリクエスト処理時にのみ読み込む**ようにする。

```ts
sha256ViaWasm: async (input) => {
  const { sha256HexViaWasm } = await import('./utils/sha256WasmServer');
  return sha256HexViaWasm(input);
},
```

これにより、実際にその機能が呼ばれない限り(テストでは呼ばれない限り)`.wasm`の静的import自体が評価されず、テスト収集が壊れない。

TypeScriptで`.wasm`をimportするには、アンビエント型宣言が必要(`src/wasm-module.d.ts`):

```ts
declare module '*.wasm' {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}
```

## 6. `@ast-grep/wasm`はtsx(CJSトランスパイル)経由で実行すると壊れる

`scripts/index-file-deps.mjs`(ビルド時にimport依存グラフを抽出するNodeスクリプト)を最初 `scripts/index-file-deps.ts` として書き `npx tsx` で実行したところ、以下のエラーで落ちた:

```
SyntaxError: Invalid or unexpected token
    at wrapSafe (node:internal/modules/cjs/loader:1637:18)
```

原因: プロジェクトの `package.json` に `"type": "module"` が無いため、tsxはこのスクリプトをCJSとしてトランスパイルする。ところが `@ast-grep/wasm` パッケージ内部(`wasm.js`)は `.wasm` をESM importしており、CJS `require()` 経由の読み込みコンテキストでは `.wasm` importが正しく解釈されず構文エラーになる。

**対処**: このスクリプトだけ `tsx` を経由させず、プレーンなNode ESM(`.mjs`拡張子)として直接 `node scripts/index-file-deps.mjs` で実行する構成にした。TypeScriptの型チェックの恩恵は失うが、スクリプト自体は小さく型無しでも十分書ける規模だったため許容した。

**教訓**: `.wasm`のESM importに依存するnpmパッケージをNodeスクリプトから使うときは、tsx/ts-node等のCJSトランスパイラ経由を避け、プレーンなNode ESM(`.mjs`、または `package.json` に `"type": "module"` を設定した領域)で実行すること。

## 7. CSP(Content-Security-Policy)で`WebAssembly.instantiate`がブロックされる

サイト全体のCSPが `script-src 'self' 'unsafe-inline'` のままだと、ブラウザ側で `WebAssembly.instantiate`(またはWASMのコンパイル)がブロックされる:

```
Refused to create a WebAssembly object because 'unsafe-eval' or 'wasm-unsafe-eval' is
not an allowed source of script in the following Content Security Policy directive:
"script-src 'self' 'unsafe-inline'".
```

**対処**: `script-src` に `'wasm-unsafe-eval'` を追加する必要がある。ただしサイト全体のCSPを緩めるのではなく、**WASMを使うページのハンドラだけでCSPを上書き**した(このリポジトリのCSP設定ミドルウェアは「レスポンスヘッダーが未設定の場合のみ」CSPを設定する作りなので、ハンドラ側で先に `c.header('Content-Security-Policy', ...)` を呼べば、そのページだけ上書きできる)。

```ts
app.get('/sha256-wasm', authMiddleware, async (c) => {
  c.header(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
  );
  return c.html(getSha256WasmPage(user.sub));
});
```

## 8. D1マイグレーションはテーブル作成→データ投入の順で実行する(初歩的だが忘れやすい)

`/file-deps`機能で、ユーザーに「テーブル作成SQL」と「実データ投入SQL(`scripts/index-file-deps.mjs`の出力)」を2つのファイルとして渡したところ、データ投入SQLを先に実行してしまい `no such table: ts_file_dependencies: SQLITE_ERROR` になった。

**教訓**: マイグレーションSQLとデータ投入SQLを分けて渡す場合、**実行順序を毎回明記する**こと(「まずCREATE TABLE、次にINSERT」)。特に生成AIが複数ファイルを一度に送ると、ユーザーがどちらから実行すべきか自明ではない。

## 9. Workersの「起動時設定」は即座には反映されない

`/wasm-modules`ページでWASMモジュールの起動時読み込みON/OFFをD1に保存できるようにしたが、Cloudflare Workersには「今すぐ再起動する」という明示的な操作が無い。設定は次にWorker isolateが新規に立ち上がったタイミング(次回のコールドスタート)から反映される。この制約はUIに明記しておくこと(ユーザーが「設定を保存したのに反映されない」と混乱するのを防ぐため)。

## 10. 既存のVite/vitest設定でWASMの静的importが失敗する場合

`sha256WasmServer.ts`/`factorWasmServer.ts`/`digWasmServer.ts`/`lsWasmServer.ts`のように、
`public/wasm/<name>.js`から`initSync`を呼び`.wasm`を静的importするサーバー側実装を、
`app.request(...)`経由の統合テスト(vitest、Node実行)で実際に最後まで実行しようとすると、
以下のエラーで必ず失敗する(新規に作った`ls-wasm`だけの問題ではなく、既存の
`sha256`/`factor`/`dig`でも同じエラーになることを`/neko factor`で実機確認済み):

```
Cannot find module './factor_bg.js' imported from .../public/wasm/factor_bg.wasm
```

原因: `wasm-bindgen --target web`が出力する`.wasm`バイナリは、自身の関数呼び出し規約の一部
(externref操作等)を`./<name>_bg.js`という名前空間からのimportとして宣言している。ブラウザの
`WebAssembly.instantiate`はこの名前空間を単なる文字列キーとして扱い、`<name>.js`側の
`initSync()`が`__wbg_get_imports()`で自前に組み立てたオブジェクトを渡すだけなので、
実際に`<name>_bg.js`というファイルが存在するかどうかは無関係(ブラウザでは正しく動く)。
しかしVite/vitestのNode実行環境で`.wasm`を静的importすると、Vite側のwasm処理が
バイナリの宣言済みimportをNodeの実モジュール解決にかけてしまい、実在しない
`<name>_bg.js`を本当に`import`しようとしてエラーになる。

**対処と検証範囲**: 既存のVite/vitest統合テストでは、dynamic importの配線と無効化設定を確認する。計算ロジックはRustのネイティブテストでも確認できるが、これだけでWASMバイナリやJSグルーの実行成功まで保証しない。

Node自体で実行できないわけではない。2026-11-13の隔離検証では、JSグルーへ対応するバイナリを明示的に渡すハーネスで、本体9モジュールの実関数結果をNode・Chrome・workerdそれぞれで確認した。Viteの静的importを通す統合テストとは別の検証経路である。実行ハーネスと結果は[調査レポート](REPORT.cloudflare-workers-github-oauth-1.RUST-1.100.20261113.md)および[根拠ログ](artifacts/rust-1.100-20261113/)を参照。

## 関連ドキュメント

- [`wasm/README.md`](wasm/README.md) — WASMモジュールのビルド手順、サーバー側での再利用方法
- 関連PR: #1353(陸地タップ判定、WASM本題とは無関係だが同期間の作業)、#1354(CSP修正)、#1355(`/neko 256`)、#1356(`/wasm-modules`)、#1357(`/file-deps`)

## 2026-11-13補足: リリース版とスキーマ版の区別

wasm-bindgenのcrate/CLIのリリース版番号だけでは互換性は断定できない。0.2.129のwasm-bindgen-sharedはSCHEMA_VERSION="0.2.128"を使い、CLI 0.2.128でも実生成・workerdの/pingが成功した。一方MSBのschema 0.2.128とCLI 0.2.127は実際にエラーになる。版をそろえる運用を基本にしつつ、例外は上流定数と実処理で確認する。根拠: https://github.com/wasm-bindgen/wasm-bindgen/blob/0.2.129/crates/shared/src/lib.rs 。今回のRust 1.100検証結果はREPORT.cloudflare-workers-github-oauth-1.RUST-1.100.20261113.md。
