# /ruby-wasm から /sqlx-d1-examples の任意サンプルを読み込んで実行する方法

**対象**: `rust-worker-sqlx-d1` の `/sqlx-d1-examples`・`/sqlx-d1-examples/data`(Rust/`sqlx_d1`によるD1実例集)と、`cloudflare-workers-github-oauth-1` の `/ruby-wasm`ページ(`src/views/rubyWasm.ts`、WASI版CRuby)。両ワーカーをまたいで「sqlx-d1側の実例をRuby側で読み込んで実行する」ための現状の到達点と、実際にライブ取得する場合に必要な変更点をまとめる。

## 結論

| 方法 | 追加実装 | 今すぐ使えるか |
|---|---|---|
| A. 固定JSON埋め込み(既存の前例をなぞる) | 不要 | ✅ 今すぐ可能 |
| B. サーバーサイド中継経由のライブ取得(推奨) | `cloudflare-workers-github-oauth-1`側に中継エンドポイント追加 + Ruby VMへの注入コード | 未実装 |
| C. 直接クロスオリジンfetch | CSP変更(`/ruby-wasm`) + CORS追加(`rust-worker-sqlx-d1`側) | 未実装(B案より変更範囲が広い) |

## A. 今すぐできる方法(前例をなぞる)

`/ruby-wasm`ページには既に「sqlx-d1出力アダプタ」という名前のサンプルがある(`src/views/rubyWasm.ts`の`RUBY_REPL_SNIPPETS`)。`/sqlx-d1-examples/data`が返す`SectionOutcome`形式(`{"status":"ok","rows":[...]}` / `{"status":"error","message":"..."}`)のJSONを**固定文字列として埋め込み**、`JSON.parse`で読むデモになっている。

```ruby
require "json"
raw = %q({
  "user_sessions": {"status":"ok","rows":[{"user_id":"octocat","timezone":"JST"}]},
  "api_endpoint_stats": {"status":"ok","rows":[{"endpoint":"GET /api/user","status_code":200,"count":42}]}
})
report = JSON.parse(raw)
report.each { |section, outcome| puts "#{section}: #{outcome.fetch("rows").size}件" }
```

任意のサンプルを試す手順:
1. `rust-worker-sqlx-d1`の`/sqlx-d1-examples/data`を開き、使いたいセクションのJSONをコピーする。
2. `/ruby-wasm`の新規/既存スニペットの`%q(...)`内に貼り付ける。
3. `JSON.parse`で読んで好きなRubyロジックを書く。

この設計は`SPEC.cloudflare-workers-github-oauth-1.ruby-wasm-sqlx-d1-adapter.md`に明記された方針で、コード変更は不要。

## なぜ「ライブ取得」ではなく固定JSONなのか(裏取りした3つの壁)

| 壁 | 現状 | 根拠(ファイル:行) |
|---|---|---|
| ruby.wasm自体がfetchできない | WASI版CRubyにはブラウザfetchへの標準的なブリッジが無い | `SPEC.cloudflare-workers-github-oauth-1.ruby-wasm-sqlx-d1-adapter.md`「実装方針: 実ネットワークには依存しない」節 |
| `/ruby-wasm`ページのCSP | `connect-src 'self' https://cdn.jsdelivr.net https://esm.sh`のみ。`rust-worker-sqlx-d1`のオリジンは許可されていない | `cloudflare-workers-github-oauth-1/src/index.ts:12395`(`/ruby-wasm`ルートのCSPヘッダ) |
| `/sqlx-d1-examples/data`のCORS | `Access-Control-Allow-Origin`が一切設定されていない | `rust-worker-sqlx-d1/src/lib.rs:139`(ルート定義)。`src/headerinspector.rs`は別機能でCORSの概念を解説しているのみで、このルートには適用されていない |

仮にJS側からfetchを試みても、CSPかCORSのいずれかでブラウザに止められる。

## B案: サーバーサイド中継(推奨)

`cloudflare-workers-github-oauth-1`側に`/api/sqlx-d1-examples-proxy`のような中継エンドポイントを追加する。

1. Worker自身(ブラウザのCSP/CORSを受けないサーバーサイド)が`rust-worker-sqlx-d1`の`/sqlx-d1-examples/data`をfetchする。
2. 結果を同一オリジンのJSONとして返す。
3. `/ruby-wasm`ページのJSはこの同一オリジンURLをfetchする(CSP変更不要、`connect-src 'self'`のまま)。
4. 取得したJSON文字列をruby.wasmのVMへ(`vm.eval`等で)グローバル変数として注入し、Ruby側の`JSON.parse`で読む。

**利点**: CSP変更・CORS変更のいずれも不要。中継エンドポイントの認可(`authMiddleware`)もそのまま効く。
**欠点**: 中継エンドポイントの実装・テストが新たに必要。

## C案: 直接クロスオリジンfetch

1. `/ruby-wasm`のCSPの`connect-src`に`rust-worker-sqlx-d1`の実ドメインを追加する。
2. `rust-worker-sqlx-d1`の`/sqlx-d1-examples/data`に`Access-Control-Allow-Origin`(`cloudflare-workers-github-oauth-1`のオリジンに限定するのが望ましい)を追加する。
3. `/ruby-wasm`のJSから直接fetchし、結果をRuby VMへ注入する。

**欠点**: 2リポジトリ・2ワーカーにまたがる変更が必要で、B案より変更範囲が広い。`rust-worker-sqlx-d1`側は無認証の公開エンドポイントのため、CORSを広く許可すると他オリジンからも読めるようになる点に注意。

## 共通事項

B案・C案のいずれでも「JS側でfetchしてから、その結果をRubyのVMに文字列として渡す」構成になる点は共通(ruby.wasm自身はネットワークを持たないため)。これは`SPEC.cloudflare-workers-github-oauth-1.ruby-wasm-sqlx-d1-adapter.md`の注意事項で「真にHTTPフェッチを伴うRuby↔Rust連携のデモが必要な場合は、別途サーバーサイド実行(Worker側からのRuby実行、または`/sqlx-d1-examples/data`をfetchしてから結果をRubyへ渡す構成)の検討が必要」としてスコープ外にされていたものと同じ結論である。

## 未着手事項

- B案・C案とも実装していない(本レポートは調査・方針整理のみ)。
- どちらを採用するかはユーザーの判断待ち。
