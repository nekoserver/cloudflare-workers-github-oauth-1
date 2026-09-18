# SPEC.cloudflare-workers-github-oauth-1.20260919

## リポジトリ全体の現在の仕様(スナップショット)

**対象**: リポジトリ全体(`src/index.ts` 約23,000行、`src/views/*.ts` 134ファイル、
D1テーブル129種、Rust/Go製WASMモジュール9種、テストファイル620本) —
これまでの多数の機能別SPEC(`SPEC.cloudflare-workers-github-oauth-1.*.md`)が
個々の変更の記録であるのに対し、本ドキュメントは2026-09-19時点での
アプリケーション全体のアーキテクチャ・機能構成をゼロから俯瞰的にまとめた
スナップショットである。個々の機能の詳細な経緯・故障シナリオ・テスト一覧は
既存の機能別SPECファイル(13章「関連ドキュメント索引」参照)に譲り、本書は
「今このリポジトリが何であるか」を把握するための入口として使う。

---

## 1. このリポジトリは何か

Cloudflare Workers 上で動く単一の Hono アプリケーション(`src/index.ts` の
1ファイルに大半のルートが集約されている)。当初は「GitHub OAuth + JWT認証」
のテンプレートだったが(`package.json` の description に名残がある)、
現在は GitHub 連携ダッシュボード・AIチャット・多数の実験的ミニアプリ
(WebGL/物理演算/WASM電卓/ゲーム等)・運用ダッシュボードを同居させた、
1人のユーザー(`nekoserver`)向けの個人用マルチツールWorkerになっている。

- 本番Worker名: `cloudflare-workers-github-oauth-1`(`wrangler.toml`)
- エントリポイント: `src/worker-entry.ts` → `src/index.ts`(Hono app)
- 姉妹Worker: `nekoserver/dynamicneko`(別デプロイ、React 19 SPA、Service Binding経由で本体WorkerのAPIを呼ぶ)、`nekoserver/cf-auth`(独立したOAuth2認証サービス、`cf-auth/`サブディレクトリとしてこのリポジトリにも取り込まれている)

---

## 2. デプロイ構成・バインディング(`wrangler.toml` / `src/types.ts`)

| 種別 | 名前 | 用途 |
|---|---|---|
| D1 Database | `DB` (`workers-github-oauth`) | ほぼ全機能の永続化先。129テーブル |
| Workers AI | `AI` | PR要約・キーワード分類・AIチャット・Jev評価補助等 |
| Service Binding | `DYNAMICNEKO` | `/neko hellodw` が dynamicneko への起動確認pingに使う。`*.workers.dev` 同士の直接fetchはCloudflareに拒否される(HTTP 404 error code 1042)ためService Binding必須 |
| Analytics Engine | `ANALYTICS` (`github_oauth_metrics`) | メトリクス送信 |
| assets | `./public` | 静的ファイル(WASMバイナリ・アイコン・CSS等) |

Vectorize・R2・KV・Queuesの直接バインディングは持たない。「ベクトル検索」
(`aichat_keyword_embeddings` / `wine_embeddings` 等)は Workers AI の埋め込み
モデル出力をD1にBLOB/TEXTとして保存し、アプリ側でコサイン類似度を計算する
自前実装(`SPEC.cloudflare-workers-github-oauth-1.VECTORIZE.md`参照)。

### 主なシークレット(`wrangler secret put`で設定、`[vars]`に平文で書かない)

`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`/`JWT_SECRET`/`RESEND_WEBHOOK_SECRET`/
`SLACK_SIGNING_SECRET`/`SLACK_OAUTH_TOKEN`/`SLACK_CLIENT_ID`/`SLACK_CLIENT_SECRET`/
`SLACK_CHANNEL_ID`/`GITHUB_TOKEN`/`GH_ATTACH_UPLOAD_TOKEN`/`DYNAMICNEKO_PING_SECRET`/
`KIMI_CODE_EXTERNAL_SECRET`/`AICHAT_EXTERNAL_SECRET`/`AICHAT_USER_TOKEN_SECRET`/
`JEV_API_KEY`/`CURSOR_API_KEY`/`GOOGLE_CSE_API_KEY`/`GOOGLE_CSE_CX`/
`GITHUB_WEBHOOK_SECRET`/`CF_AUTH_WEBHOOK_SECRET`/`CF_WH1_WEBHOOK_SECRET`/
`HARNESS_HOOK_SECRET`/`RESEND_API_KEY`

---

## 3. 認証・セッション

| 方式 | 実装 | 用途 |
|---|---|---|
| GitHub OAuth + JWT | `authMiddleware`(`src/middleware/auth.ts`) | Cookie(JWT)によるブラウザセッション。全ページの標準認証 |
| APIキー(Bearer) | 同ミドルウェア内でヘッダ検証 | `/api-keys` で発行したキーによる外部API利用。`api_endpoint_stats`/`api_key_endpoint_stats`で利用統計を自動集計 |
| `optionalAuthMiddleware` | 同ファイル | 未ログインでも表示できるページ(一部公開ページ)向け |
| `aichatAuthMiddleware` | 同ファイル | AIチャット系エンドポイント専用の認証(レート制限`aichat_rate_limit`と統合) |
| dynamicneko等の外部Worker向けBearer secret認証 | 各`*-external`エンドポイント | `AICHAT_EXTERNAL_SECRET`等の共有シークレットで別Workerからの呼び出しを認可し、内部ではサーバー側で検証済みのemail→GitHub loginのみを信頼する(リクエスト本文のuser_idは信用しない、詳細は`SPEC.cloudflare-workers-github-oauth-1.AICHAT_SUBQUERY_WORKFLOW.md`) |
| WebAuthn/パスキー | `user_public_keys`/`public_key_challenges` | `/public-keys` での公開鍵登録・照合(補助的な検証手段、ログインそのものはGitHub OAuth) |
| セッション有効期限 | `user_sessions.idle_timeout_seconds` | 設定値解決順序は D1優先 → Cookie → ハードコードデフォルトの順(CLAUDE.mdルール27) |

マルチテナント設計として `workspaces` / `teams` / `team_members` があり、
`user_sessions.current_workspace_id` が実質的な「今のワークスペース」を表す。

---

## 4. 主要ページ一覧(カテゴリ別、`GET`ルートより抜粋)

### 4-1. コア(認証・アカウント)
`/` `/auth/github` `/auth/github/callback` `/auth/github/reauthorize` `/auth/switch`
`/auth/logout` `/auth/email-confirm` `/auth/slack/install` `/welcome` `/userinfo`
`/settings` `/api-keys` `/public-keys` `/repositories`

### 4-2. GitHub連携ダッシュボード
`/status`(D1テーブル状況・キャッシュ状況の統合ダッシュボード) `/d1-query-catalog`
`/function-changelog`(関数変更履歴・カタログ) `/harness-log` `/call-graph`
`/file-deps` `/column-stats` `/legacy-storage-inventory` `/workflow` `/workflow/:no`
`/apis`(APIリファレンス) `/gh-attach`(`gh issue create --attach`のWASM移植)

### 4-3. AIチャット・回答分析
`/aichat`(メイン。左サイドバーに過去ログ検索・露出ログ・サブクエリ・質問分析等。
`SPEC.cloudflare-workers-github-oauth-1.AICHAT_SUBQUERY_WORKFLOW.md`他多数のSPEC参照)
`/aichat-image-gallery` `/answer-graph` `/kw-architecture` `/kw-drilldown`
`/jev-score-board` `/jev-label-stats` `/jev-rev-viewer` `/moondream-analyze-log`
`/moondream-vlm` `/cursor-agent`(Cursor Background Agent連携) `/kimi-code`
`/kimi-code/markdown/:id`

### 4-4. WASM電卓・ツール系(Rust/Go WASM、`/neko`スラッシュコマンドとも連動)
`/sha256-wasm` `/factor-wasm` `/sqlc-wasm` `/uuid` `/base64` `/bin-hex` `/ruby-wasm`
`/md-preview` `/json-explorer` `/html-run-preview`関連

### 4-5. データ検索・参照系
`/wine-search` `/cheese-search` `/heritage-area` `/heritage-access`
`/heritage-journey` `/legacy-storage-inventory`

### 4-6. WebGL/物理演算/ゲーム/雑多なデモ(実験的ミニアプリ群)
`/webgl-cube` `/webgl-demo` `/webgl-faults` `/webgl-heritage` `/webgl-lv-sphere`
`/webgl-solar` `/webgl-sphere` `/galaxy` `/matrix` `/megaminx`
`/pentagon-kaleidoscope` `/origami-sculpture` `/eclipse-tilt-lesson`
`/equal-earth-map` `/airline-network` `/fly-brain` `/fly-brain-mahjong`
`/chess-tsume-17te` `/worldcup-knockout` `/worldcup-wdl` `/mlb` `/tdf`
`/tsubuyaki` `/tsuru-no-niwa` `/brush-jjaemu` `/image3d` `/htmlrewriter-demo`
`/fetch-text-stream-demo` `/wf-browser` `/cf-dashboard`

### 4-7. 運用・監視
`/health` `/countdown`(汎用カウントダウンウィジェット。APIキー期限等がここに自動登録される) `/wasm-modules`(WASMモジュールの有効/無効切替)

ページ数はテストファイル・ビューファイルの対応から134ビューファイル、
GETルートだけで約90ページ(APIエンドポイントを除く)。

---

## 5. `/neko` スラッシュコマンド(AIチャット内コマンド)

`src/utils/aichatSlashCommand.ts` に32種のサブコマンドが実装されている
(詳細な実装言語の内訳は [`slash-command-languages.html`](slash-command-languages.html) 参照)。
TypeScript純粋関数のみのもの(`hms`/`epoch`/`cal`/`kana`等)、D1に問い合わせるもの
(`search`/`s`/`j`/`clog`/`tokens`等)、Rust WASMを呼ぶもの(`256`/`factor`/`ls`)、
WASM+外部APIを組み合わせるもの(`dig`/`gh pr list`/`tree`)、別Workerへの
Service Binding呼び出し(`hellodw`)まで多様な実装形態が混在する。

---

## 6. D1スキーマ概観(129テーブル)

`STATUS_TABLE_DEFINITIONS`(`src/index.ts`)に全テーブルが登録され、`/status`
ページで存在確認・行数・カラム定義(PK/FK/UK/IDXバッジ付き)を横断的に閲覧できる。
`TABLE_GROUP_MAP` によるおおまかな分類:

| グループ | 概要 | 代表テーブル |
|---|---|---|
| ai(41) | AIチャット・埋め込み・分類・レート制限 | `ai_chat_shares` `aichat_keyword_embeddings` `aichat_answer_vectors` `jev_evaluations` `ai_summary_log` |
| system(34) | 運用・キャッシュ・API統計・各種WASMツールのログ | `api_endpoint_stats` `webhook_log` `ts_function_catalog` `harness_hook_log` `cursor_agent_launch_log` |
| auth(11) | 認証・セッション・APIキー・パスキー | `user_sessions` `api_keys` `user_public_keys` `login_history` |
| config(10) | 設定・組織連携・カタログ | `slack_installations` `notification_settings` `table_catalog` |
| commit(10) | GitHubコミット関連キャッシュ | `commit_calendar_cache` `repo_commit_index` `commit_search_history` |
| email(6) | Resend/メール通知 | `email_send_log` `email_suppression_list` `email_mfa_challenges` |
| wine(3) | ワイン検索 | `wine_embeddings` `wine_details` `wine_metadata` |
| search(2) | APIリファレンス内検索 | `api_search_keywords` |
| (未分類/個別機能) | 文化財検索・カウントダウン・Jev・Ruby WASM・ワークフロー等、機能追加時にTABLE_GROUP_MAPへの登録が漏れているものを含む | `heritage_*` `countdown_events` `jev_label_groups` `ruby_wasm_snippets` `workflow_*` |

新テーブル追加時は `STATUS_TABLE_DEFINITIONS` / `TABLE_COLUMN_KEYS` /
`TABLE_GROUP_MAP` / `COLUMN_FK_TARGETS`(必要なら`COLUMN_FK_TARGET_COLUMNS`も) /
`STATUS_MIGRATION_SQL` の5箇所への登録が必須(CLAUDE.mdルール23、
`SPEC.cloudflare-workers-github-oauth-1.NEWTABLE_CHECK.md`)。migrationファイルは
`migrations/` に133本(一部はテーブル作成を伴わない列追加等)。

---

## 7. WASM/多言語連携

| モジュール | 言語 | 用途 |
|---|---|---|
| `sha256-wasm` | Rust(wasm-bindgen) | `/sha256-wasm`・`/neko 256` |
| `factor-wasm` | Rust | `/factor-wasm`・`/neko factor`(素因数分解・素数判定) |
| `ls-wasm` | Rust | `/neko ls`(WASMモジュール一覧整形) |
| `dig-wasm` | Rust | `/neko dig`(DNSクエリ組み立て/応答パース、通信はTypeScript fetch) |
| `gh-wasm` | Rust | `/neko gh pr list`(`gh` CLI相当のMarkdown整形) |
| `gh-attach-wasm` | Go | `/gh-attach`(`gh issue create --attach`相当) |
| `tree-wasm` | Rust | `/neko tree`・dynamicneko tree-viewページ用(GitHub Trees API結果の整形・フィルタ) |
| `sqlc-wasm` | Go | `/sqlc-wasm`(SQL関連ツール、`SPEC.cloudflare-workers-github-oauth-1.20260906.sqlc-go-wasm.md`) |
| `jev-wasm` | Rust | Jev評価関連の補助WASM |

`ruby+stdlib.wasm`(公式CRuby WASMバイナリ、現在4.0系)は `/ruby-wasm` と
`/kimi-code/markdown/:id` がブラウザ側で`WebAssembly.compile`(非ストリーミング)
してRubyコードを実行する。`compileStreaming`はiOS等でハング/失敗するため
使わない(`SPEC.cloudflare-workers-github-oauth-1.20260915.md` 4〜5章)。

各WASMモジュールは `/wasm-modules` ページ(`wasm_module_startup_config`
テーブル)から個別に有効/無効を切り替えられる。

---

## 8. 外部サービス連携

| サービス | 用途 | 備考 |
|---|---|---|
| GitHub OAuth App / GitHub App | ログイン・PR/コミット取得・Webhook受信 | `/webhook/github`でインストール権限変更をリアルタイムD1同期 |
| Slack | PRサマリー通知・`/pts`等のSlashコマンド・app_mention応答 | `NOTIFY_TARGET`で外部Worker経由の通知にも切替可能 |
| Resend | メール送信・バウンス/配信ログのWebhook受信 | `email_*`系テーブルで送信ログ・抑制リスト・監査異常を管理 |
| Cloudflare Workers AI | PR要約・キーワード分類・AIチャット応答・埋め込み生成 | モデルはGemma-4系がデフォルト、Qwen等に切替可能 |
| dynamicneko(Service Binding) | 起動確認ping、および逆方向にdynamicneko→本体WorkerへのBearer secret認証HTTP呼び出し(AIチャット・Jev評価・tree-view等の`*-external`エンドポイント群) | 双方向だが認証方式・向きが異なる。混同注意(`SPEC.cloudflare-workers-github-oauth-1.AICHAT_SUBQUERY_WORKFLOW.md`背景セクション) |
| Cursor Background Agent API | `/cursor-agent`からのVM起動・履歴検索 | `CURSOR_API_KEY`未設定時は起動を無効化 |
| Jev(TypeSafe AI System One Model) | AIチャット回答の品質評価(`jev_*`テーブル群) | `JEV_API_KEY` |
| Google Custom Search JSON API | `/neko vlink`(YouTubeリンク検索) | `GOOGLE_CSE_API_KEY`+`GOOGLE_CSE_CX`両方必須 |
| MLB Stats API | `/mlb`の試合情報 | 無認証の公開API |

---

## 9. 開発・運用ルール(CLAUDE.md 要約)

詳細は `CLAUDE.md` 本体を参照。主要な恒久ルールのみ抜粋:

- **テスト**: コード変更前に失敗するテストを書き、`git push`直前に必ず`npx vitest run`(現在620ファイル)を実行する
- **秘密情報**: `GITHUB_CLIENT_ID`等は`wrangler secret`管理、`[vars]`への平文記載禁止
- **PRはブラウザから手動作成**: この開発環境からGitHub APIは使えないため、push後にcompareリンク/実際のPR作成はGitHub MCP経由または手動
- **デプロイはユーザー側**: `CLOUDFLARE_API_TOKEN`が無いためこの環境から`wrangler deploy`は不可
- **catchの3義務**: 握りつぶす場合は記録・通知・テストの3点を満たす
- **エラー型は判別可能なUnion型で表現**: 文字列prefix(`startsWith`判定)は禁止
- **PWA/CSS/HTML手順書**: それぞれ専用の詳細ルール(`CLAUDE.md`内リンク先、`CLAUDE.CSS.md`等)に従う
- **SPEC/NOTICEファイル運用**: 本書もこの運用ルールに従って作成している(1章参照)
- **コミット前の新関数検出**: 変更ファイルを`scripts/index-functions.ts`にかけ、`ts_function_catalog`更新SQLをチャットで提示(自動アップロードしない)

---

## 10. テスト・品質

- テストランナー: Vitest。`src/**/*.test.ts` 620ファイル
- D1を伴うテストは `node:sqlite` の `DatabaseSync` + 簡易`wrapD1()`アダプタで
  インメモリDBを構築するパターンが標準(多数のSPECファイルに実例あり)
- 型チェック: `npx tsc --noEmit`
- フロントエンドHTML内`<script>`の構文エラー検出: `new Function(scriptContent)`を
  使った専用テストパターンが各ページテストに存在

---

## 11. 姉妹リポジトリとの関係

| リポジトリ | 関係 |
|---|---|
| `nekoserver/dynamicneko` | 別デプロイのCloudflare Worker(React 19 + Vite + Cloudflare Dynamic Worker Loader)。本体WorkerのAPIをService Binding + Bearer secretで呼び出す。`/samples`(UIパターン集)・`/css-tables`(CSS装飾集)・`/jev-scores`・`/tree-view`等のページを持つ |
| `nekoserver/cf-auth` | 独立したOAuth2認証サービス。`cf-auth/`サブディレクトリとしてこのリポジトリに取り込まれているが、`dynamicneko`のVite/Reactビルドには組み込まれていない独立パッケージ |

`repo_commit_index`テーブルは本体・dynamicneko・cf-authの3リポジトリの
コミット履歴を横断的に記録する(`SPEC.cloudflare-workers-github-oauth-1.COMMITDB.md`)。

---

## 12. 既知の複雑さ・注意点(横断的な落とし穴)

- **shallow clone**: この開発環境のgit cloneは既定でshallowになっており、
  コミット履歴を根拠にした調査(`git log -S`等)が不完全な結果を返すことがある。
  `git fetch --unshallow`または`--depth`を広げたfetchが必要
  (`NOTICE.cloudflare-workers-github-oauth-1.20260906.md`)
- **モデル固有の癖**: `gemma-4-26b-a4b-it`はsystem messageがあるとthinking modeを
  強制的に有効化し、`<think>`タグ以外の形式で推論過程が応答に混入することがある
- **文字列prefixでのエラー判定は禁止**: 過去に`[AI_NO_BINDING]`等の新しい
  prefixが判定漏れして誤分類された実績があり、判別可能なUnion型に統一済み
- **z-index管理**: 複数モーダルが同居するページでは固定z-indexではなく
  `getNextZ()`で動的算出する(CLAUDE.mdルール26)

---

## 13. 関連ドキュメント索引

本書は全体像のスナップショットであり、個々の機能の詳細な経緯・故障シナリオ・
テスト一覧・コミット履歴は以下の既存ドキュメント群を参照すること(抜粋、
日付なしの機能別SPECのみ列挙。日付のみの`SPEC.*.YYYYMMDD.md`はその日の
セッション変更記録):

| ファイル | 内容 |
|---|---|
| `SPEC.cloudflare-workers-github-oauth-1.AICHAT_SUBQUERY_WORKFLOW.md` | AIチャット過去ログ露出記録・サブクエリリンク機能 |
| `SPEC.cloudflare-workers-github-oauth-1.dynamicneko-aichat-flow.md` | dynamicneko↔本体WorkerのAI問い合わせ・応答フロー |
| `SPEC.cloudflare-workers-github-oauth-1.VECTORIZE.md` | D1上の自前ベクトル検索の仕組み |
| `SPEC.cloudflare-workers-github-oauth-1.COMMITDB.md` | `repo_commit_index`運用手順 |
| `SPEC.cloudflare-workers-github-oauth-1.NEWTABLE_CHECK.md` | 新テーブル追加時の登録必須箇所 |
| `SPEC.cloudflare-workers-github-oauth-1.FUNCTIONS.md` | 関数カタログ(`ts_function_catalog`)の仕組み |
| `SPEC.cloudflare-workers-github-oauth-1.AI_MODEL.md` | AIモデル選択・フォールバック方針 |
| `SPEC.cloudflare-workers-github-oauth-1.ANSWER-GRAPH.md` / `answer-graph.20260808.md` | 回答伝播グラフ機能 |
| `SPEC.cloudflare-workers-github-oauth-1.20260827.heritage-journey.md` | 文化財巡りルート機能 |
| `SPEC.cloudflare-workers-github-oauth-1.20260829.gh-wasm.md` | `gh-wasm`モジュール |
| `SPEC.cloudflare-workers-github-oauth-1.20260831.ruby-wasm.md` | Ruby WASM統合 |
| `SPEC.cloudflare-workers-github-oauth-1.20260906.sqlc-go-wasm.md` | Go製`sqlc-wasm` |
| `SPEC.cloudflare-workers-github-oauth-1.20260904.public-keys.md` | パスキー/公開鍵機能 |
| `SPEC.cloudflare-workers-github-oauth-1.20260907.user-preferences.md` | ユーザー設定解決順序 |
| `SPEC.cloudflare-workers-github-oauth-1.cf-auth-deadline-countdown.20260911.md` | cf-auth期限カウントダウン連携 |
| `SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md` / `20260914.md` | `/cursor-agent`機能 |
| `SPEC.cloudflare-workers-github-oauth-1.20260913.md` 〜 `20260915.md` | 直近セッションの変更記録(APIキー期限カウントダウン・Ruby WASM 4.0移行等) |
| `slash-command-languages.html` | `/neko`スラッシュコマンドの実装言語一覧(インタラクティブ表) |
| `dynamicneko-aichat-flow.html` / `pr-summary-saas-map.html` | 上記SPECのHTML版・SaaS構成全体図 |

NOTICEファイル群(`NOTICE.cloudflare-workers-github-oauth-1.*.md`)には
「知らないと損する」落とし穴の記録が蓄積されている(shallow clone・
PWA・N+1問題・GitHub webhook経路等)。調査を始める前に索引
(`CLAUDE.md`内の「個別トピックの索引」)を確認すること。
