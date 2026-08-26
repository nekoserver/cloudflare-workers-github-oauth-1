# NOTICE: Rust/WASM実装まとめ

**対象**: このリポジトリでRustをWASM化してWorker/ブラウザ上で実行する一連の実装(`/sha256-wasm`、`/neko 256`、`/wasm-modules`、`/file-deps`)で得た知見・落とし穴・忘れると損する手順をまとめる。今後同様のRust/WASM機能を追加するときに最初に読むこと。

---

## 1. この環境のRustツールチェーン

- `cargo`/`rustc` はプリインストール済み(バージョンは都度 `rustc --version` で確認)。
- `wasm32-unknown-unknown` ターゲットは未インストール状態からでも追加できる:
  ```bash
  rustup target add wasm32-unknown-unknown
  ```
- crates.io からの依存取得・ビルドはネットワーク的に問題なく通る。
- `wasm-bindgen-cli` は `cargo install` で入る。**インストールするバージョンは、依存する `wasm-bindgen` crateのバージョンと一致させること**(不一致だとJSグルーコード生成時にエラーになる)。
  ```bash
  cargo install wasm-bindgen-cli --version 0.2.127
  ```

## 2. 純Rustクレート(Cのコード生成を含まない)はwasm32ビルドが通る

`sha256-wasm`(`wasm/sha256-wasm/`、`sha2`クレート使用)のような、依存が全部Rustで完結するクレートは何の問題もなく `wasm32-unknown-unknown` にビルドできる。

```bash
cd wasm/sha256-wasm
cargo build --release --target wasm32-unknown-unknown
wasm-bindgen --target web --out-dir ../../public/wasm --out-name sha256 \
  target/wasm32-unknown-unknown/release/sha256_wasm.wasm
```

## 3. C言語のコード生成を含むクレートはこの環境ではwasm32ビルドできない(重要な制約)

`tree-sitter-typescript` のような、tree-sitterのパーサーがC言語で生成されているクレートを `wasm32-unknown-unknown` 向けにビルドしようとすると、C toolchain側で失敗する:

```
fatal error: 'stdlib.h' file not found
```

原因は、wasm32向けのCヘッダー一式(WASI SDK等の`wasm32`向けsysroot)がこの環境に存在せず、`apt-get`でのインストールも制限されているため追加できないこと。

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

## 10. vitest(Node)環境では`wasm-bindgen --target web`出力を実際に実行できない(既存の全モジュールで共通の制約)

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

**結論・対処**: この制約により、**このリポジトリのvitestテストではRust/WASM機能の
「実際の計算結果」をNode経由で検証できない**。既存のsha256/factor/digも同様の理由で、
統合テスト側は次の2点だけを検証し、実行結果の正しさの検証はRust側の`cargo test`
(`wasm/<name>-wasm/src/lib.rs`内の`#[cfg(test)] mod tests`、JsValueに依存しない
`_impl`関数を経由してネイティブでもテスト可能にする)に完全に委ねる設計にしている:
  1. `index.ts`が対象モジュールをdynamic importで正しく配線しているか(ソース文字列検索)
  2. `/wasm-modules`ページでの無効化設定が尊重され、無効時はWASMを一切実行せずに
     エラーメッセージを返すか

新しいWASMモジュールを追加するときも、TSの統合テストで「実際にWASMを実行して結果を
検証する」テストを書こうとして原因不明のエラーに時間を溶かさないよう、最初から
上記2点(配線・無効化)のみをTS側でテストし、計算ロジック自体はRustの`cargo test`で
テストすること。

## 関連ドキュメント

- [`wasm/README.md`](wasm/README.md) — WASMモジュールのビルド手順、サーバー側での再利用方法
- 関連PR: #1353(陸地タップ判定、WASM本題とは無関係だが同期間の作業)、#1354(CSP修正)、#1355(`/neko 256`)、#1356(`/wasm-modules`)、#1357(`/file-deps`)
