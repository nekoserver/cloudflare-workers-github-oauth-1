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
  含んでいないか事前に確認すること。
- **jsDelivrの`+esm`はパッケージ直下URL専用、任意のサブパスには効かない**:
  `https://cdn.jsdelivr.net/npm/<pkg>@<version>+esm` は依存解決済みバンドルを
  返すが、`https://cdn.jsdelivr.net/npm/<pkg>@<version>/dist/esm/foo.js+esm`
  のように任意のサブパスへ付けても効かず、生ファイルがそのまま返ってくる
  (実機で修正後も同じエラーが再現し判明)。エントリポイント以外の特定
  ファイルをbare specifier解決込みで取得したい場合は使えない。
- 代わりに**esm.sh**(`https://esm.sh/<pkg>@<version>/<subpath>`)を使うと、
  任意のサブパスに対してもファイル内のbare specifierを解決済みURLへ自動的に
  書き換えてくれるため、`/ruby-wasm`ではesm.sh経由でJSグルーコードを読み込む
  方式に切り替えて解決した。CSPの`script-src`/`connect-src`に
  `https://esm.sh` の追加も忘れないこと。バイナリ本体(`.wasm`)自体は
  ESM importではなく単純な`fetch()`なのでbare specifier問題は無関係であり、
  引き続きjsDelivrから取得している。

## 索引への追記

- Rust/WASM実装(wasm32ビルド制約・ブラウザ/サーバー共用・vitestとの相性・CSP・ast-grep):
  [`NOTICE.cloudflare-workers-github-oauth-1.rust-WASM.md`](NOTICE.cloudflare-workers-github-oauth-1.rust-WASM.md)
  に加えて、本ファイル(CRuby WASMの公式配布パッケージ利用)も参照。
