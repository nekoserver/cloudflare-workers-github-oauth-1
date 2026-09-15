# NOTICE.cloudflare-workers-github-oauth-1.20260915

## /ruby-wasm は公式 4.0 バイナリを読む

**対象**: `/ruby-wasm` と `/kimi-code/markdown/:id` が fetch する
`RUBY_WASM_BINARY_URL`。

CRuby 自体は自前 wasm32 ビルドできないので、公式 npm の WASI ビルドを CDN から読む。
2026-09-15 時点の読み込み先は `@ruby/4.0-wasm-wasi@2.10.1` の `ruby+stdlib.wasm`。
JS グルーはこれまで通り `@ruby/wasm-wasi@2.10.1`（esm.sh）。

ビルドラインを上げるときはバイナリ URL だけ変えればよい。kimi-code 側も同じ定数を使う。
スニペット表の `ruby_version` DEFAULT `'3.4'` は過去行用のマイグレーション値であり、
新規保存は `getRubyWasmVersionInfo().rubyBuildLine`（いまは `4.0`）が入る。

## 4.0 の巨大 WASM は compileStreaming しない

**対象**: `/ruby-wasm` のブラウザ初期化。

`WebAssembly.compileStreaming(fetch の Response)` は MIME が `application/wasm` でも、
gzip された数十MBの WASM で iOS Safari がハングするか失敗する。3.4(約30MB)では
たまたま通っていたのが、4.0(約32MB)で表面化した。

対処は本文を最後まで読んで `WebAssembly.compile(arrayBuffer)` すること。
公式の `browser.script.ts` も `compileStreaming` が無い環境ではこの経路に落とす。

jsDelivr の HEAD/Range で先頭4バイトを見ると `\0asm` にならないことがある。
`Content-Encoding` 付きの Range は圧縮バイトが返るためで、バイナリ破損の証拠には使えない。

進捗の分母に `Content-Length` を使うとき、ヘッダは圧縮後サイズ、`body.getReader()` は
展開後バイトを返すことがある。受信が総量を超えたらパーセントを出さず受信MBだけ出す。

Cache API の `put` は iOS の容量制限で失敗しうる。失敗しても読み込みは続行し、
理由は `rubyWasmCachePutError` に残す。次回復元はネットワーク取得になる。

起動直後に `RUBY_VERSION` を評価し、期待ビルドライン(いまは `4.0`)で始まらなければ
読み込み失敗にする。ステータスには実バージョンを出す。`puts RUBY_VERSION` が
`3.4.1` のままなのに成功扱いすると、4.0 に切り替えたつもりで 3.4 バイナリを
実行し続ける。

jsDelivr の `@ruby/4.0-wasm-wasi@2.10.1/dist/ruby+stdlib.wasm` 本体を 2026-09-15 に
取得して確認した。マジックは `\0asm`、`RUBY_DESCRIPTION` は
`ruby 4.0.0 (2025-12-25 revision 553f1675…)`。`ruby 3.4.1` という説明文字列は
入っていない。したがってブラウザで `puts RUBY_VERSION` が `3.4.1` なら、
4.0 バイナリではなく **3.4 の URL を読んでいる古い HTML** が動いている。
`GET /ruby-wasm` の HTML は `Cache-Control: private, no-store` にし、
初期コードを `puts RUBY_VERSION` にする。


## 初回が遅いのは 32MB をグルーの後で取り始めていたから

**対象**: `/ruby-wasm` の読み込み開始タイミング。

`import(esm.sh)` が解決してから `fetch(ruby+stdlib.wasm)` すると、巨大バイナリの
ダウンロード開始が遅れる。`<link rel="preload" as="fetch" crossorigin="anonymous">`
で HTML パース直後から取り始め、JS 側は `Promise.all` でグルーとバイナリを同時に待つ。

preload を効かせるには fetch の CORS を anonymous に揃える
(`mode: 'cors', credentials: 'omit'`)。揃えないとブラウザが preload を捨てて
二重ダウンロードになる。

stdlib 無しの `ruby.wasm` は小さいが、ページが `require 'stringio'` するため使わない。



