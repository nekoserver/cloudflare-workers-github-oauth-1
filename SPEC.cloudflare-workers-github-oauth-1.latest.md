# SPEC.cloudflare-workers-github-oauth-1.latest

## リポジトリ全体の現在の仕様(スナップショット)

**対象**: リポジトリ全体(`src/index.ts` 約24,800行、`src/views/*.ts` 141ファイル、
D1テーブル139種、Rust/Go製WASMモジュール12種、テストファイル660本) —
[`SPEC.cloudflare-workers-github-oauth-1.20260919.md`](SPEC.cloudflare-workers-github-oauth-1.20260919.md)
と同一の13章構成・評価軸を保ったまま、2026-09-24時点(`origin/main` `4536649`)の
状態へ更新した版。本ファイルは「最新スナップショット」の定位置として運用し、
以後再生成する際もこの13章構成を維持すること。個々の機能の詳細な経緯・
故障シナリオ・テスト一覧は既存の機能別SPECファイル(13章「関連ドキュメント
索引」参照)に譲り、本書は「今このリポジトリが何であるか」を把握するための
入口として使う。

旧版の`SPEC.cloudflare-workers-github-oauth-1.latest.md`(2026-03時点、
OAuth/JWTコア仕様とResend webhook/Slack通知のみを扱う統合版)は、本書に
統合される形で置き換えられた。旧版が扱っていたOAuth/JWT・Resend・Slackの
内容は本書3章・8章に引き継がれている。

---

## 1. このリポジトリは何か

Cloudflare Workers 上で動く単一の Hono アプリケーション(`src/index.ts` の
1ファイルに大半のルートが集約されている)。当初は「GitHub OAuth + JWT認証」
のテンプレートだったが(`package.json` の description に名残がある)、
現在は GitHub 連携ダッシュボード・AIチャット・多数の実験的ミニアプリ
(WebGL/物理演算/WASM電卓/ゲーム等)・運用ダッシュボードを同居させた、
1人のユーザー(`nekoserver`)向けの個人用マルチツールWorkerになっている。
20260919時点からの変化はない(全体としての性質は同じ)。

- 本番Worker名: `cloudflare-workers-github-oauth-1`(`wrangler.toml`)
- エントリポイント: `src/worker-entry.ts` → `src/index.ts`(Hono app)
- 姉妹Worker: `nekoserver/dynamicneko`(別デプロイ、React 19 SPA、Service Binding経由で本体WorkerのAPIを呼ぶ)、`nekoserver/cf-auth`(独立したOAuth2認証サービス、`cf-auth/`サブディレクトリとしてこのリポジトリにも取り込まれている)

---

## 2. デプロイ構成・バインディング(`wrangler.toml` / `src/types.ts`)

| 種別 | 名前 | 用途 |
|---|---|---|
| D1 Database | `DB` (`workers-github-oauth`) | ほぼ全機能の永続化先。139テーブル |
| Workers AI | `AI` | PR要約・キーワード分類・AIチャット・Jev評価補助等 |
| Service Binding | `DYNAMICNEKO` | `/neko hellodw` が dynamicneko への起動確認pingに使う。`*.workers.dev` 同士の直接fetchはCloudflareに拒否される(HTTP 404 error code 1042)ためService Binding必須 |
| Analytics Engine | `ANALYTICS` (`github_oauth_metrics`) | メトリクス送信 |
| assets | `./public` | 静的ファイル(WASMバイナリ・アイコン・CSS等) |

バインディング構成自体は20260919時点から変化なし。Vectorize・R2・KV・Queues
の直接バインディングは持たない。「ベクトル検索」(`aichat_keyword_embeddings` /
`wine_embeddings` 等)は Workers AI の埋め込みモデル出力をD1にBLOB/TEXTとして
保存し、アプリ側でコサイン類似度を計算する自前実装
(`SPEC.cloudflare-workers-github-oauth-1.VECTORIZE.md`参照)。

### 主なシークレット(`wrangler secret put`で設定、`[vars]`に平文で書かない)

`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`/`JWT_SECRET`/`RESEND_WEBHOOK_SECRET`/
`SLACK_SIGNING_SECRET`/`SLACK_OAUTH_TOKEN`/`SLACK_CLIENT_ID`/`SLACK_CLIENT_SECRET`/
`SLACK_CHANNEL_ID`/`GITHUB_TOKEN`/`GH_ATTACH_UPLOAD_TOKEN`/`DYNAMICNEKO_PING_SECRET`/
`KIMI_CODE_EXTERNAL_SECRET`/`AICHAT_EXTERNAL_SECRET`/`AICHAT_USER_TOKEN_SECRET`/
`JEV_API_KEY`/`CURSOR_API_KEY`/`GOOGLE_CSE_API_KEY`/`GOOGLE_CSE_CX`/
`GITHUB_WEBHOOK_SECRET`/`CF_AUTH_WEBHOOK_SECRET`/`CF_WH1_WEBHOOK_SECRET`/
`HARNESS_HOOK_SECRET`/`RESEND_API_KEY`/
**`JEV_PLAYGROUND_EXTERNAL_SECRET`(新規、`/jev-playground`の外部連携用)**/
**`CLOUDFLARE_API_KEY`(新規、`/cf-dashboard`がCloudflare REST API経由でD1一覧を
取得する際のオプション認証。未設定時はD1バインディング経由にフォールバック)**

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
20260919時点から認証方式自体の追加・変更はない。

---

## 4. 主要ページ一覧(カテゴリ別、`GET`ルートより抜粋)

GETルート(APIを除く)は約94本(20260919時点は約90)。以下、新規追加分を
太字で示す。

### 4-1. コア(認証・アカウント)
`/` `/auth/github` `/auth/github/callback` `/auth/github/reauthorize` `/auth/switch`
`/auth/logout` `/auth/email-confirm` `/auth/slack/install` `/welcome` `/userinfo`
`/settings` `/api-keys` `/public-keys` `/repositories`

### 4-2. GitHub連携ダッシュボード
`/status`(D1テーブル状況・キャッシュ状況の統合ダッシュボード。カラム統計は
**`/status/column-stats`へ統合移動**、旧`/column-stats`は廃止)
`/d1-query-catalog` `/function-changelog`(関数変更履歴・カタログ) `/harness-log`
`/call-graph` `/file-deps` `/legacy-storage-inventory` `/workflow` `/workflow/:no`
`/apis`(APIリファレンス) `/gh-attach`(`gh issue create --attach`のWASM移植)
**`/cron-status`(cronジョブの稼働状況ダッシュボード、新規)**

### 4-3. AIチャット・回答分析
`/aichat`(メイン。左サイドバーに過去ログ検索・露出ログ・サブクエリ・質問分析・
「探索の境界線」パネル・自動探索等。`SPEC.cloudflare-workers-github-oauth-1.AICHAT_SUBQUERY_WORKFLOW.md`
他多数のSPEC参照。自動探索の詳細は
`SPEC.cloudflare-workers-github-oauth-1.20260924.auto-explore.md`)
`/aichat-image-gallery` `/answer-graph` `/kw-architecture` `/kw-drilldown`
`/jev-score-board` `/jev-label-stats` `/jev-rev-viewer` `/moondream-analyze-log`
`/moondream-vlm` `/cursor-agent`(Cursor Background Agent連携) `/kimi-code`
`/kimi-code/markdown/:id` **`/jev-playground`(Jev評価の実験用プレイグラウンド、新規)**

### 4-4. WASM電卓・ツール系(Rust/Go WASM、`/neko`スラッシュコマンドとも連動)
`/sha256-wasm` `/factor-wasm` `/sqlc-wasm` `/uuid` `/base64` `/bin-hex` `/ruby-wasm`
`/md-preview` `/json-explorer` `/html-run-preview`関連
**`/go-diff-wasm`(Go製go-diff-wasmによる2テキストの行単位差分表示、新規)**
**`/gron-wasm`(Go製gron-wasm、`/json-structural-diff`と連携、新規)**
**`/json-structural-diff`(gron-wasm×go-diff-wasmによるJSON構造差分表示、新規。
配列の要素順序変更も差分として検出してしまう制約があり、CLAUDE.mdルール35で
「本番運用では原則使わない」方針が明記されている)**

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
**`/earth-composer-2.5`(地球儀ビジュアライゼーション、新規)**

### 4-7. 運用・監視
`/health` `/countdown`(汎用カウントダウンウィジェット。APIキー期限等がここに自動登録される) `/wasm-modules`(WASMモジュールの有効/無効切替)

ページ数はテストファイル・ビューファイルの対応から141ビューファイル
(20260919時点は134)、GETルートだけで約94ページ(APIエンドポイントを除く)。

---

## 5. `/neko` スラッシュコマンド(AIチャット内コマンド)

`src/utils/aichatSlashCommand.ts` に35種前後のサブコマンドが実装されている
(`/neko help`のヘルプ一覧は41行、一部コマンドはオプション別に複数行で
案内されるため実装数と行数は一致しない。20260919時点は32種)。
TypeScript純粋関数のみのもの(`hms`/`epoch`/`cal`/`kana`等)、D1に問い合わせるもの
(`search`/`s`/`j`/`clog`/`tokens`等)、Rust WASMを呼ぶもの(`256`/`factor`/`ls`)、
WASM+外部APIを組み合わせるもの(`dig`/`gh pr list`/`tree`)、別Workerへの
Service Binding呼び出し(`hellodw`)まで多様な実装形態が混在する。

新規追加分(20260919以降):
- `/neko tvupdate [--dryrun] [-R owner/repo]` — tree-view静的スナップショットの手動更新(待機制限は撤去済み、常にGitHubから再取得)
- `/neko tvlog` — tree-view更新の最新10件を表示
- `/neko msb` — microsandbox(`msb`)CLIのヘルプ・ツリー表示をWASM経由で表示

---

## 6. D1スキーマ概観(139テーブル)

`STATUS_TABLE_DEFINITIONS`(`src/index.ts`)に全テーブルが登録され、`/status`
ページで存在確認・行数・カラム定義(PK/FK/UK/IDXバッジ付き)を横断的に閲覧できる。
`TABLE_GROUP_MAP` によるおおまかな分類(20260919時点との差分をカッコ内に記載):

| グループ | 概要 | 代表テーブル |
|---|---|---|
| ai(49、+8) | AIチャット・埋め込み・分類・レート制限・探索の境界線 | `ai_chat_shares` `aichat_keyword_embeddings` `aichat_answer_vectors` `aichat_answer_keyword_vectors` `aichat_keyword_category_map` `jev_evaluations` `ai_summary_log` |
| system(34、±0) | 運用・キャッシュ・API統計・各種WASMツールのログ | `api_endpoint_stats` `webhook_log` `ts_function_catalog` `harness_hook_log` `cursor_agent_launch_log` |
| commit(13、+3) | GitHubコミット関連キャッシュ | `commit_calendar_cache` `repo_commit_index` `commit_search_history` |
| auth(11、±0) | 認証・セッション・APIキー・パスキー | `user_sessions` `api_keys` `user_public_keys` `login_history` |
| config(10、±0) | 設定・組織連携・カタログ | `slack_installations` `notification_settings` `table_catalog` |
| email(6、±0) | Resend/メール通知 | `email_send_log` `email_suppression_list` `email_mfa_challenges` |
| wine(3、±0) | ワイン検索 | `wine_embeddings` `wine_details` `wine_metadata` |
| search(2、±0) | APIリファレンス内検索 | `api_search_keywords` |
| (未分類/個別機能、11) | 文化財検索・カウントダウン・Jev・Ruby WASM・ワークフロー等、機能追加時にTABLE_GROUP_MAPへの登録が漏れているものを含む | `heritage_*` `countdown_events` `jev_label_groups` `ruby_wasm_snippets` `workflow_*` |

新テーブル追加時は `STATUS_TABLE_DEFINITIONS` / `TABLE_COLUMN_KEYS` /
`TABLE_GROUP_MAP` / `COLUMN_FK_TARGETS`(必要なら`COLUMN_FK_TARGET_COLUMNS`も) /
`STATUS_MIGRATION_SQL` の5箇所への登録が必須(CLAUDE.mdルール23、
`SPEC.cloudflare-workers-github-oauth-1.NEWTABLE_CHECK.md`)。migrationファイルは
`migrations/` に144本(20260919時点は133本。一部はテーブル作成を伴わない
列追加・note更新等)。

**補足(「探索の境界線」/自動探索まわり)**: 一時的に`aichat_auto_explore_history`
テーブル(migration 0160)が追加されたが、再検索抑止機能ごとrevertされて
現在は存在しない。詳細は`SPEC.cloudflare-workers-github-oauth-1.20260924.auto-explore.md`
5章参照。

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
| **`go-diff-wasm`(新規)** | Go | 2テキストの行単位差分をMarkdown整形。`/go-diff-wasm`、dynamicnekoの`/diff-viewer`・tree-viewの「差分」ボタンで共用 |
| **`gron-wasm`(新規)** | Go | JSONをgrep可能な`gron`形式へ展開。`/json-structural-diff`でgo-diff-wasmと組み合わせ使用(配列順序を無視しない制約あり、CLAUDE.mdルール35) |
| **`msb-wasm`(新規)** | Rust | microsandbox(`msb`)CLIのヘルプ・ツリー表示のみをWASM化。`/neko msb` |

`ruby+stdlib.wasm`(公式CRuby WASMバイナリ、現在4.0系)は `/ruby-wasm` と
`/kimi-code/markdown/:id` がブラウザ側で`WebAssembly.compile`(非ストリーミング)
してRubyコードを実行する。`compileStreaming`はiOS等でハング/失敗するため
使わない(`SPEC.cloudflare-workers-github-oauth-1.20260915.md` 4〜5章)。

各WASMモジュールは `/wasm-modules` ページ(`wasm_module_startup_config`
テーブル)から個別に有効/無効を切り替えられる。WASMモジュール数は12種
(20260919時点は9種)。

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
| Jev(TypeSafe AI System One Model) | AIチャット回答の品質評価(`jev_*`テーブル群)。自動探索(4章)の各キーワード処理でも必須段階として使われる | `JEV_API_KEY` |
| Google Custom Search JSON API | `/neko vlink`(YouTubeリンク検索) | `GOOGLE_CSE_API_KEY`+`GOOGLE_CSE_CX`両方必須 |
| MLB Stats API | `/mlb`の試合情報 | 無認証の公開API |
| **Cloudflare REST API(新規、任意)** | `/cf-dashboard`がD1バインディングの代わりにアカウント横断でテーブル一覧を取得する際のオプション経路 | `CLOUDFLARE_API_KEY`+`CLOUDFLARE_ACCOUNT_ID`未設定時はD1バインディング経由にフォールバック |

20260919時点からの変化は「Cloudflare REST API」経路の追加のみ。

---

## 9. 開発・運用ルール(CLAUDE.md 要約)

詳細は `CLAUDE.md` 本体を参照。主要な恒久ルールのみ抜粋(20260919時点から
追加された項目には**新規**マーク):

- **テスト**: コード変更前に失敗するテストを書き、`git push`直前に必ず`npx vitest run`(現在660ファイル)を実行する
- **秘密情報**: `GITHUB_CLIENT_ID`等は`wrangler secret`管理、`[vars]`への平文記載禁止
- **PRはブラウザから手動作成**: この開発環境からGitHub APIは使えないため、push後にcompareリンク/実際のPR作成はGitHub MCP経由または手動
- **デプロイはユーザー側**: `CLOUDFLARE_API_TOKEN`が無いためこの環境から`wrangler deploy`は不可
- **catchの3義務**: 握りつぶす場合は記録・通知・テストの3点を満たす
- **エラー型は判別可能なUnion型で表現**: 文字列prefix(`startsWith`判定)は禁止
- **PWA/CSS/HTML手順書**: それぞれ専用の詳細ルール(`CLAUDE.md`内リンク先、`CLAUDE.CSS.md`等)に従う
- **SPEC/NOTICEファイル運用**: 本書もこの運用ルールに従って作成している(1章参照)
- **コミット前の新関数検出**: 変更ファイルを`scripts/index-functions.ts`にかけ、`ts_function_catalog`更新SQLをチャットで提示(自動アップロードしない)
- **新規**: **テンプレートリテラル内のエスケープ注意**(ルール29): `src/views/*.ts`はHTML全体をTypeScriptのtemplate literalとして返すため、`\'`/`\"`/単独`\n`/正規表現の`\`系が意図しない文字変換を起こしページが白紙になる事故がある。pushの直前にgrep等で確認すること
- **新規**: **マージ済みPRのブランチへ追加pushしない**(ルール34): 既存ブランチへコミットを追加する前に、対応PRが既にマージ/クローズ済みでないか確認する。マージ済みなら最新defaultブランチから作り直す(本セッションでも複数回この手順を踏んだ実績あり)
- **新規**: **`/json-structural-diff`は本番運用で使わない方針**(ルール35): 配列要素の並び替えも差分ありと表示してしまう制約があるため、正しさの根拠にはしない

---

## 10. テスト・品質

- テストランナー: Vitest。`src/**/*.test.ts` 660ファイル(20260919時点は620)
- D1を伴うテストは `node:sqlite` の `DatabaseSync` + 簡易`wrapD1()`アダプタで
  インメモリDBを構築するパターンが標準(多数のSPECファイルに実例あり)
- 型チェック: `npx tsc --noEmit`
- フロントエンドHTML内`<script>`の構文エラー検出: `new Function(scriptContent)`を
  使った専用テストパターンが各ページテストに存在
- 姉妹リポジトリ`dynamicneko`側は Vitest Browser Mode(`vitest-browser-react`、
  `CHROME_PATH=/opt/pw-browsers/chromium`)によるブラウザテストと、`tsc -p
  tsconfig.test.json`でコンパイルしてNodeで実行するテストの2系統が併存する
  (20260919時点のこの章には記載がなかった、dynamicneko側の変更頻度が高いため補足)

---

## 11. 姉妹リポジトリとの関係

| リポジトリ | 関係 |
|---|---|
| `nekoserver/dynamicneko` | 別デプロイのCloudflare Worker(React 19 + Vite + Cloudflare Dynamic Worker Loader)。本体WorkerのAPIをService Binding + Bearer secretで呼び出す。`/samples`(UIパターン集)・`/css-tables`(CSS装飾集)・`/jev-scores`・`/tree-view`・`/diff-viewer`(新規、go-diff-wasm移植)等のページを持つ |
| `nekoserver/cf-auth` | 独立したOAuth2認証サービス。`cf-auth/`サブディレクトリとしてこのリポジトリに取り込まれているが、`dynamicneko`のVite/Reactビルドには組み込まれていない独立パッケージ |

`repo_commit_index`テーブルは本体・dynamicneko・cf-authの3リポジトリの
コミット履歴を横断的に記録する(`SPEC.cloudflare-workers-github-oauth-1.COMMITDB.md`)。
dynamicneko側の`/tree-view`静的スナップショット(`TREE_VIEW_SAMPLE_DATA`)は
本体リポジトリのファイル構成変化に自動追従しないため、`/workflow/0021`の
手順で定期的に再生成が必要(対象は現在実在するリポジトリのみに限定する
運用ルールを2026-09-24に明示)。

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
- **新規: テンプレートリテラル内のエスケープ**: `src/views/*.ts`のHTML生成で
  `\'`/`\"`/単独`\n`/正規表現リテラルの`\`系を書くと、TypeScriptのtemplate
  literal評価時に意図しない文字へ変換され`<script>`が構文エラーになり画面が
  白紙になる(CLAUDE.mdルール29)
- **新規: PRの自動マージが早い**: このリポジトリはドラフトPRがほぼ即座に
  自動マージされる運用のため、同じブランチへ追加コミットをpushする前に
  必ずPRのマージ状態を確認する必要がある(CLAUDE.mdルール34)。本書自体の
  執筆中も複数回、直前に作ったブランチが既にマージ済みで作り直す事態が発生した
- **新規: `/json-structural-diff`の配列順序制約**: gronはキー順をソートするが
  配列のインデックスはソートしないため、要素の並び替えだけでも「差分あり」と
  表示される(CLAUDE.mdルール35)。正しさの判定根拠には使わない方針

---

## 13. 関連ドキュメント索引

本書は全体像のスナップショットであり、個々の機能の詳細な経緯・故障シナリオ・
テスト一覧・コミット履歴は以下の既存ドキュメント群を参照すること(抜粋、
日付なしの機能別SPECのみ列挙。日付のみの`SPEC.*.YYYYMMDD.md`はその日の
セッション変更記録。**新規**マークは20260919以降に追加されたもの):

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
| `SPEC.cloudflare-workers-github-oauth-1.20260913.md` 〜 `20260919.md` | 2026-09-13〜19の変更記録(APIキー期限カウントダウン・Ruby WASM 4.0移行等) |
| **`SPEC.cloudflare-workers-github-oauth-1.20260924.auto-explore.md`(新規)** | AIチャット「探索の境界線」パネル・自動探索機能の仕様・API契約・変遷 |
| **`EVAL.cloudflare-workers-github-oauth-1.aichat-page.20260924.md`(新規)** | `/aichat`ページ全体(送信フロー・レート制限・画像添付・共有)の設計評価。レート制限のDB例外握りつぶし、自動探索とレート制限の相互作用の2件を課題として指摘 |
| `EVAL.cloudflare-workers-github-oauth-1.ai-chat.20270917.md` | AIチャットのチャート一覧・`/neko`スラッシュコマンド一覧(既存) |
| `EVAL.cloudflare-workers-github-oauth-1.code-review.md` | コードレビュー機能(A系統/B系統)の設計評価(既存、「あるべき設計/現状実装/評価」フォーマットの先例) |
| `slash-command-languages.html` | `/neko`スラッシュコマンドの実装言語一覧(インタラクティブ表) |
| `dynamicneko-aichat-flow.html` / `pr-summary-saas-map.html` | 上記SPECのHTML版・SaaS構成全体図 |

NOTICEファイル群(`NOTICE.cloudflare-workers-github-oauth-1.*.md`)には
「知らないと損する」落とし穴の記録が蓄積されている(shallow clone・
PWA・N+1問題・GitHub webhook経路等)。調査を始める前に索引
(`CLAUDE.md`内の「個別トピックの索引」)を確認すること。

---

## 14. 直近のセッション変更履歴(新しい順、2026-10-03〜10-04)

**対象**: このセッションでGitHub webhook/通知経路(`src/utils/notifyDispatch.ts`・
`/webhook/github`)に加えた2件の変更。コミットログを新しい方から辿った順に記載する。

### 2026-10-04: push通知のchannelをSlackチャンネル名固定からリポジトリ名に変更(PR #2242、未マージ)

**対象**: `src/utils/notifyDispatch.ts`の`sendToWorker`、`/webhook/github`のpushハンドラ。
ブランチ`claude/push-webhook-cf-auth-channel-20261004`。

#### 旧来のSlack通知との比較

| 観点 | 旧来(Slack直接投稿、`NOTIFY_TARGET`未設定時) | `NOTIFY_TARGET=worker`(Altワーカー経由)での旧実装 | 今回の修正後 |
|---|---|---|---|
| 送信先 | Slack `chat.postMessage`(`postSlackMessage`) | dynamicneko/cf-authの`/ingest` | 同左(変更なし) |
| `channel`欄の意味 | Slackの投稿先チャンネルID(`SLACK_CHANNEL_ID`)。Slackの仕様上、他の値を入れても意味を持たない | `config.slackChannel`(`SLACK_CHANNEL_ID`)が**そのままコピーされていた** | pushイベントでは`repositoryFullName`(例: `nekoserver/rails-root`)を渡す。他の通知種別(installation等)は従来通り`config.slackChannel` |
| 受信側がchannelをどう使うか | Slack自体がチャンネルとして解釈(投稿先の決定) | cf-auth側は値の意味を検証せず`alt_notify_ingest_log.channel`へそのまま保存するだけ | 同左(保存ロジック自体は不変)。保存される**値の意味**が変わった |
| リポジトリ単位の絞り込み可否 | 不可(Slackは1チャンネルにまとめて投稿する設計で、そもそもリポジトリ別に分ける仕組みがない) | 不可(`channel`に無関係な固定値が入っていたため、cf-auth側で`channel = リポジトリ名`の絞り込みができなかった) | **可能になった**(`channel`に実際のリポジトリ名が入るため、cf-auth側のPR #300で追加した`getUnlinkedIngestLogByChannel`で絞り込める) |

つまり、Slack直接投稿という旧来の経路は「全リポジトリの通知が1つのチャンネルに流れ込む」設計であり、そもそもリポジトリ別に分離する発想がなかった。`NOTIFY_TARGET=worker`はその制約を外すために作られた経路のはずだったが、実装時に`channel`欄へ機械的に`config.slackChannel`を流用してしまい、「Slack向けの値をそのままAltワーカー向けにも使う」という旧来の発想を引き継いだまま、本来の目的(リポジトリ別の構造化データ)を果たせていなかった。今回、`NotifyMessage.channel`という呼び出し元ごとの上書き値を導入し、pushイベントだけリポジトリ名を渡すようにしたことで、ようやく「Altワーカー経由ならリポジトリ別に読める」という`NOTIFY_TARGET=worker`本来の狙いが実現した。

#### やったこと

1. CLAUDE.mdルール10/12に従い、まずD1の実データで裏取りしようとしたが、このClaude Codeセッションには`CLOUDFLARE_API_TOKEN`が無く`wrangler d1 execute --remote`が使えないため、D1への直接問い合わせは断念し、コード読解(`/webhook/github`のpush分岐→`notifyDispatch.ts`→cf-authの`/ingest`→`feed.ts`の`getFeed`/`getChannels`)だけで原因を特定した。
2. `NotifyMessage`に`channel?: string`を追加し、`sendToWorker`で`message.channel ?? config.slackChannel`を使うよう変更(`target='slack'`では無視され、Slack自体の挙動は変えない)。
3. pushハンドラで`channel: repositoryFullName`を渡すよう変更。
4. 既存の`webhook-github-push-notify-20261001.test.ts`(2026-10-01に追加されたテスト、ちょうど`nekoserver/rails-root`をサンプルに使っていた)にアサーションを追加する形で検証した。

#### 得たもの(教訓)

- 「固定ペイロードに見える送信処理」でも、呼び出し元の種類(installation通知 / push通知 / cf-authアクセス判定通知等)によって本来意味が変わるべきフィールドが、実装の都合で1つの値に押し込められていないかを疑う視点。今回は`channel`がまさにそれだった。
- Slack向けの値(チャンネルID)とAltワーカー向けの値(リポジトリ名)は、たまたま同じJSONキー名(`channel`)を共有していたために「同じ値を流用すればよい」と誤解されやすい。**キー名が同じでも、送信先ごとに値の意味が違う可能性を確認すること**。
- D1に直接アクセスできない開発環境でも、送信側→受信側のコードを順にたどることで、実データを見ずに原因を特定できるケースがある(ただし本来はルール10/12の通りD1の実データ確認が先であるべきで、今回は環境制約による例外対応)。

### 2026-10-03: GitHub App既存インストールへの追加リポジトリがinstallation_permissionsへ反映されない不具合を修正(`06e955c`、マージ済み)

**対象**: `/webhook/github`の`installation`/`installation_repositories`イベント処理。

#### やったこと

`installation_repositories`イベント(既存インストールへのリポジトリ追加/削除時にGitHubが送る、`action=added/removed`)の判定が、`installation`イベント用の`action`値(`created`/`new_permissions_accepted`/`unsuspend`)しかカバーしておらず、後から追加したリポジトリが`installation_permissions`(D1)へ反映されない不具合を修正した。判定ロジックを`isInstallationPermissionsUpdateAction`として関数に切り出し、`added`/`removed`を追加した。

#### 得たもの(教訓)

- GitHubの似た名前の2つのイベント(`installation`と`installation_repositories`)は、`action`フィールドの値集合が異なる。片方だけを想定した判定ロジックは、もう片方のイベントが届いたときに静かに無視してしまう(エラーにならないため気づきにくい)。
- この修正自体はコードのpushだけで即時反映されるわけではなく、GitHub App側が次に該当Webhookを再送するタイミング(または手動でのアクセス再設定)まで待つ必要がある、という運用上の制約も判明した。
