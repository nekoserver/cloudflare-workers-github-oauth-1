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
