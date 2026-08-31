# NOTICE 2026-08-31

## `/ruby-wasm` — CRuby WASMは自前ビルドせず公式npmパッケージをCDN経由で使う

**対象**: Rust/WASM実装全般。C言語で書かれたツール(CRuby、tree-sitter系など)を
「WASM化して動かしたい」と思ったとき最初に確認すべきこと。

- CRuby(本家Ruby処理系)はC言語実装のため、`NOTICE.cloudflare-workers-github-oauth-1.rust-WASM.md`
  3節と同じ理由でこの環境では `wasm32-unknown-unknown` へ自前ビルドできない。
- Ruby公式プロジェクト `ruby/ruby.wasm` が npm パッケージ `@ruby/wasm-wasi` +
  `@ruby/<version>-wasm-wasi`(例: `@ruby/3.4-wasm-wasi`)としてビルド済みの
  CRuby WASM(WASI)バイナリを配布している。`DefaultRubyVM(wasmModuleOrResponse)`
  でVMを初期化し、`vm.eval(code)` でRubyコードを実行できる。
- ただし本体バイナリ(`ruby+stdlib.wasm`)は**約30MB**あり、このリポジトリの
  既存WASM成果物(数十KB)と比べて桁違いに大きい。リポジトリへコミットせず、
  npmパッケージがそのまま配信されているjsDelivr CDN
  (`https://cdn.jsdelivr.net/npm/@ruby/3.4-wasm-wasi@<version>/dist/ruby+stdlib.wasm`)
  からブラウザで直接fetchする構成にした。CDN配信を使う場合はCSPの
  `script-src`/`connect-src`にCDNドメインを追加する必要がある(`wasm-unsafe-eval`も従来通り必要)。
- `$stdout` の出力を画面に取得したい場合、`DefaultRubyVM`の`consolePrint`
  オプション(デフォルトtrue、`console.log`へ書き込む)に頼るのではなく、
  実行前後で `$stdout` を `StringIO` に差し替えるRubyコードでラップすると、
  ブラウザのdevtoolsを介さずJS側の文字列として結果を取得できる。
- 巨大バイナリの初回ダウンロードに数秒〜数十秒かかることをUI上に明記しないと、
  「読み込みが終わらない、壊れているのでは」とユーザーが誤解しやすい。
- **重要**: `@ruby/wasm-wasi` の `dist/esm/browser.js` は
  `import { ... } from "@bjorn3/browser_wasi_shim"` のようなbare specifier
  (パッケージ名のみのimport)を内部に含む。import mapを使わないブラウザの
  素のESM importでは解決できず、`Module name, '@bjorn3/browser_wasi_shim'
  does not resolve to a valid URL.` エラーで読み込みに失敗する
  (実機で発生・確認済み)。npmパッケージをCDN経由でブラウザに直接
  importする場合、そのファイルが依存パッケージへのbare specifierを
  含んでいないか事前に確認すること。jsDelivrはURL末尾に`+esm`を付けると
  bare specifierを含む依存関係を解決・バンドルした単一ESMファイルを
  返してくれるため、`/ruby-wasm`ではこれを使って回避した
  (例: `https://cdn.jsdelivr.net/npm/@ruby/wasm-wasi@2.10.1/dist/esm/browser.js+esm`)。

## 索引への追記

- Rust/WASM実装(wasm32ビルド制約・ブラウザ/サーバー共用・vitestとの相性・CSP・ast-grep):
  [`NOTICE.cloudflare-workers-github-oauth-1.rust-WASM.md`](NOTICE.cloudflare-workers-github-oauth-1.rust-WASM.md)
  に加えて、本ファイル(CRuby WASMの公式配布パッケージ利用)も参照。
