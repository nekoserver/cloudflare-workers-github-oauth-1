# NOTICE.cloudflare-workers-github-oauth-1.20260924.md

## Go(js/wasm)製WASMバイナリをサーバー側でstatic importすると、Vitest上でLinkErrorになる

**対象**: `.wasm`静的import(`import x from '.../foo.wasm'`)を行うすべてのファイル。特に
importが必要なGo/js-wasmモジュール(`gron-wasm`・`go-diff-wasm`)をサーバー側
(`src/utils/*WasmServer.ts`)から呼び出す場合。

### 何が起きるか

Rust(wasm-bindgen)製のWASM(`sha256-wasm`・`ls-wasm`・`msb-wasm`等)は
`.wasm`を素のimportとして扱っても問題なくテストが通る。一方、Go(js/wasm)製の
WASMバイナリ(`gron-wasm`・`go-diff-wasm`)は`syscall/js`のABI上、import section に
`gojs`名前空間の関数群(`runtime.scheduleTimeoutEvent`等、`wasm_exec.js`の
`Go`クラスが動的に組み立てるcallableの集まり)を宣言している。

このリポジトリで使っているVitest(Rolldown/oxcベースのVite)は、`.wasm`の
静的importを検出すると、バイナリのimport宣言を検査して「WebAssembly/ESM
Integration」相当の自動解決・自動instantiateを試みる。その結果:

1. まず`Cannot find package 'gojs'`エラーになる(importの名前空間を実npm
   パッケージとして解決しようとして失敗する)
2. 仮に`vitest.config.ts`の`resolve.alias`で`gojs`をダミーモジュールへ
   逃がしても、今度はVite側が**そのダミー(空)のimportObjectを使って
   自分でWebAssembly.instantiateを試み**、`function import requires a
   callable`というLinkErrorになる(呼び出し元コードが渡すはずの本物の
   `go.importObject`より先に、importの時点でVite自身が壊れた
   instantiateを実行してしまう)

Cloudflare Workers本番ビルド(Wrangler/esbuild)はこの自動解決を一切行わず、
`.wasm`をただの`WebAssembly.Module`として渡すだけ(`src/wasm-module.d.ts`の
契約通り)なので、本番では問題にならない。**あくまでVitestのテスト実行環境
だけの制約**。

### 対処法

`src/go-diff-api-server-20260924.test.ts`で採用した方法: テストファイル側で
`vi.mock('../public/wasm/go-diff.wasm', async () => { ... })`を使い、対象の
`.wasm`ファイルだけをNode標準の`WebAssembly.compile(readFileSync(...))`で
コンパイルしたモジュールに差し替える。ロジック自体(`goDiffWasmServer.ts`の
ハンドシェイク処理・`DiffText`本体)はモックせず実バイナリをそのまま動かす
ので、「モックで誤魔化してテストが意味を失う」ことにはならない。

```ts
vi.mock('../public/wasm/go-diff.wasm', async () => {
  const bytes = readFileSync(resolve(__dirname, '../public/wasm/go-diff.wasm'));
  const wasmModule = await WebAssembly.compile(bytes);
  return { default: wasmModule };
});
```

`vitest.config.ts`側に`resolve.alias`でグローバルに`gojs`を逃がす方法は
**根本解決にならない**(上記2の理由でLinkErrorに変わるだけ)ので使わないこと。
新しくGo/js-wasmモジュールをサーバー側から呼び出す場合は、同じ`vi.mock`
パターンをそのテストファイルにも適用すること。

### 関連ファイル

- [`src/utils/goDiffWasmServer.ts`](src/utils/goDiffWasmServer.ts) — `__goDiffWasmReady`
  ハンドシェイク(`go.run(instance)`をawaitせず、WASM側の`main()`が
  `globalThis.__goDiffWasmReady()`を呼ぶまで待つ)の実装
- [`src/go-diff-api-server-20260924.test.ts`](src/go-diff-api-server-20260924.test.ts) — 上記`vi.mock`の実例
- [`wasm/README.md`](wasm/README.md)の「サーバー側(Worker)からの利用(go-diff-wasmのみ)」節
