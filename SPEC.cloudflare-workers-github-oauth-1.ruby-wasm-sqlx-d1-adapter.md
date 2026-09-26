# SPEC.cloudflare-workers-github-oauth-1.ruby-wasm-sqlx-d1-adapter — /ruby-wasmにsqlx-d1出力アダプタのサンプルを追加

## 1. sqlx-d1出力アダプタサンプル

**対象**: `/ruby-wasm`ページ(`src/views/rubyWasm.ts`の`RUBY_REPL_SNIPPETS`)に追加した新規スニペット「sqlx-d1出力アダプタ」 — 姉妹Worker`rust-worker-sqlx-d1`の`/sqlx-d1-examples/data`エンドポイントが返すJSON形式(`SectionOutcome<T>`の`status:"ok"/"error"`タグ付き表現)を、Rubyの`JSON.parse`で読み取れることを示すデモ。

### 背景

`rust-worker-sqlx-d1`の`/sqlx-d1-examples`ページは、D1の実テーブルをRustの`sqlx_d1::query_as()`で`Vec<T>`へ変換する実例集で、`/sqlx-d1-examples/data`エンドポイントで同じ結果をJSON API として公開している(各セクションは`{"status":"ok","rows":[...]}`または`{"status":"error","message":"..."}`のいずれかの形)。この出力形式が「sqlx-d1(Rust)側だけでなくRuby側からも読み取れる」ことを示すアダプタサンプルとして、`/ruby-wasm`ページに追加した。

### 実装方針: 実ネットワークには依存しない

`/ruby-wasm`ページの既存スニペットは全て「ネットワーク、ファイル、時刻など実行環境に依存する例は避け、どのブラウザでも同じ結果を確認できるようにする」という設計方針(`src/views/rubyWasm.ts`冒頭のコメント参照)を取っている。`ruby.wasm`(WASI版CRuby)はブラウザのfetch APIへ直接アクセスする標準的な手段を持たないため、実際に`/sqlx-d1-examples/data`へHTTPリクエストを送るのではなく、**その出力形式を再現した固定JSON文字列**をサンプルコード内に埋め込み、`JSON.parse`で解析するデモにした。既存の「JSON 整形」スニペットと同じ`%q(...)`によるJSON埋め込みパターンを踏襲している。

### サンプルコードの内容

3セクション分(`user_sessions`・`api_endpoint_stats`・`commit_agent_log_page`)を模したJSONを`JSON.parse`し、各セクションの`status`に応じて成功時は件数、失敗時はエラーメッセージを表示する。`api_endpoint_stats`のエラーメッセージは、実際にデプロイ環境で発生した`D1_ERROR: no such table: api_endpoint_stats: SQLITE_ERROR`をそのまま使っており、`rust-worker-sqlx-d1`側の実際の障害分離設計(1テーブルの欠落が他のセクションに波及しない)がJSON側にもそのまま表れていることを示している。

## 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/views/rubyWasm.ts` | `RUBY_REPL_SNIPPETS`に「sqlx-d1出力アダプタ」を追加(カテゴリ: データ) |
| `src/ruby-wasm-repl-snippets.test.ts` | 新規スニペットの存在・ネットワーク非依存・出力形式の検証テストを追加 |

## テスト・検証

- サンプルコード自体をローカルのRuby 3.3.6インタプリタで実行し、期待通りの出力(`user_sessions: 2件` / `api_endpoint_stats: ERROR (...)` / `commit_agent_log_page: 1件`)になることを確認した
- `npx vitest run src/ruby-wasm-repl-snippets.test.ts src/ruby-wasm-practice-examples.test.ts src/ruby-wasm-page-20260831.test.ts src/ruby-wasm-csp-20260831.test.ts`: 32件全件成功
- `npx tsc --noEmit`: `rubyWasm.ts`に起因するエラー0件

いずれもローカル(このセッションの実行環境)での検証であり、`ruby.wasm`(ブラウザ上のWASI版CRuby)での実実行確認はデプロイ後にユーザー側でお願いしたい(ネイティブRuby 3.3.6での実行結果と、ページの互換性監査表が主張する「Ruby 4.0系(WASM)でもok」は別物であることに注意)。

## 注意事項

- このサンプルは「実際にHTTPで`/sqlx-d1-examples/data`を取得する」実装ではない。真にHTTPフェッチを伴うRuby↔Rust連携のデモが必要な場合は、別途サーバーサイド実行(Worker側からのRuby実行、または`/sqlx-d1-examples/data`をfetchしてから結果をRubyへ渡す構成)の検討が必要になる。今回はスコープ外とした。
