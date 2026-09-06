# sqlc Go/WASM移植プロトタイプ

## 1. `/sqlc-wasm` — sqlcクエリアノテーションをブラウザ上でパースするページ

**対象**: 新規ディレクトリ `wasm/sqlc-wasm/`(Go/js-wasm実装)、新規ページ
`GET /sqlc-wasm`(`src/views/sqlcWasm.ts`)とそのルート登録(`src/index.ts`)、
`src/data/wasmModuleRegistry.ts`への登録。sqlc(https://sqlc.dev/)の
クエリアノテーション構文(`-- name: GetAuthor :one`)をパースする部分だけを
Go(GOOS=js GOARCH=wasm)でブラウザ実行できることを確認する。

### 背景

sqlcはSQLファイルからGoの型安全なクエリ関数を生成するツールで、
PostgreSQL/MySQL/SQLite向けのSQL構文解析、スキーマとの型突き合わせ、
コード生成までを行う。これら全体をそのままWorkers/ブラウザのWASMへ
移植するのは対象が大きすぎるため、`wasm/gh-wasm/`(GitHub CLI)・
`wasm/gh-attach-wasm/`と同じ「段階的移植」の方針に従い、データベース
接続やSQL方言ごとの構文解析器を必要としない、クエリアノテーションの
パース・検証・整形部分のみを移植範囲とした。

### 既存Go/WASM実装(gh-attach-wasm)との比較

| 項目 | 内容 |
|---|---|
| ビルドターゲット | `GOOS=js GOARCH=wasm`(gh-attach-wasmと同じ、`wasm32-unknown-unknown`のRust側C言語コード生成制約(`NOTICE.cloudflare-workers-github-oauth-1.rust-WASM.md`)を受けない) |
| グルーコード | Go標準の`wasm_exec.js`(wasm-bindgen不使用) |
| 実行場所 | ブラウザのみ(`/sqlc-wasm`ページ)。サーバー(`/neko`等)配線は無し |
| 入出力 | 引数1個(SQLテキスト文字列)を受け取り、Markdownテーブル文字列を返す(JSON経由ではなく文字列そのまま) |

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `wasm/sqlc-wasm/annotations.go` | クエリアノテーションのパース(`parseQueryAnnotations`)、Markdown整形(`formatResultMarkdown`)。GOOS/GOARCHに依存しない純粋ロジック |
| `wasm/sqlc-wasm/main_js.go` | `syscall/js`ブリッジ(`js && wasm`ビルドタグ)。`sqlcParseQueryAnnotations`をグローバル関数として公開 |
| `wasm/sqlc-wasm/main_test.go` | ネイティブ`go test`で実行するユニットテスト |
| `wasm/sqlc-wasm/go.mod` | モジュール定義 |
| `public/wasm/sqlc.wasm`・`public/wasm/sqlc-wasm_exec.js` | ビルド成果物(コミット対象) |
| `src/views/sqlcWasm.ts` | `/sqlc-wasm`ページ本体。textareaにSQLを貼り付けてWASM関数を呼び、結果をMarkdownテーブルとして表示 |
| `src/index.ts` | `GET /sqlc-wasm`ルート登録。CSPに`wasm-unsafe-eval`を追加(このページのみ、sha256-wasm/factor-wasmと同じ対応) |
| `src/data/wasmModuleRegistry.ts` | `WASM_MODULE_REGISTRY`に`sqlc`エントリを追加(`/wasm-modules`ページ・`/neko ls`用) |
| `src/sqlc-wasm-20260906.test.ts` | ページ構造・CSP・XSSエスケープの単体テスト |
| `wasm/README.md` | モジュール一覧・「sqlc-wasm移植プロトタイプ」節を追記 |

## 2. 故障想定とテスト設計

| 故障シナリオ | 検出・対処 | テスト |
|---|---|---|
| アノテーション行の形式が不正(`-- name: <名前> :<コマンド>`にマッチしない) | エラーとして行番号付きで報告し、そのクエリは結果に含めない | `TestParseQueryAnnotations_MalformedAnnotationLine` |
| クエリ名が空、または識別子として不正 | エラー報告し、そのクエリは結果に含めない | `TestParseQueryAnnotations_MissingName`・`TestParseQueryAnnotations_InvalidIdentifier` |
| クエリ名が重複 | 2件目以降をエラー報告し、最初の1件のみ採用する | `TestParseQueryAnnotations_DuplicateName` |
| 未知のコマンド種別(`:onee`等のタイプミス) | エラー報告し、そのクエリは結果に含めない | `TestParseQueryAnnotations_UnknownCommand` |
| SQL本文に`|`や改行が含まれ、Markdownテーブルが壊れる | セル内`|`をエスケープ、改行をスペースに変換(CLAUDE.mdルール16) | `TestFormatResultMarkdown_EscapesPipeAndNewline`・`TestFormatResultMarkdown_NoBoxDrawingCharacters` |
| `/sqlc-wasm`のCSPが緩すぎ/足りず他ページへ波及する、またはページ自体がブロックされる | `/sqlc-wasm`のみ上書き、他ページ(`/heritage-access`)は変更なしを確認 | `src/sqlc-wasm-20260906.test.ts` |
| ユーザー名によるXSS | `escapeHtml`でエスケープ | `src/sqlc-wasm-20260906.test.ts` |
| template literal内のエスケープ文字ミス(CLAUDE.mdルール29) | サンプルSQLに単引用符・改行を含むが`\'`のような手書きエスケープをコード中に書かず、`escapeHtml`経由で埋め込む | `src/sqlc-wasm-20260906.test.ts`(script構文・textarea終端チェック) |

### 対処方針

- アノテーションのパースエラーは自動回復不能・軽微に分類し、行番号と理由をそのまま結果に含める(ユーザーが原因を判断できるようにする)。
- WASM読み込み失敗は自動回復不能・軽微に分類し、エラーメッセージをそのまま画面に表示する。

## 3. 注意事項

- `sqlc generate`本体(SQL構文解析・型突き合わせ・Goコード生成)は移植範囲に含めていない。将来必要になった場合は、まず公式が構文解析器のビルド済みWASMを配布していないか確認すること(`ruby-wasm`導入時の教訓と同じ、`SPEC.cloudflare-workers-github-oauth-1.20260831.ruby-wasm.md`参照)。
- ブラウザでの実機確認は本セッションでは実施できていない(Cloudflareへのデプロイが必要なため)。デプロイ後、ユーザー側で`/sqlc-wasm`の動作確認をお願いしたい。
- `/welcome`ページのナビゲーションドロップダウンへのリンク追加は行っていない(CLAUDE.mdルール30、依頼範囲外のため)。

## 4. 関連コミット

**対象**: 本仕様に対応する履歴 — コミット作成後にGitHub上のコミットリンクを追記する。

本変更のコミットで初回実装する。
