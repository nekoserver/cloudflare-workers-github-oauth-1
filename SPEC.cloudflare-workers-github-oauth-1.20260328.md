# SPEC.cloudflare-workers-github-oauth-1.20260328

## 1. PRをWorkers AIで要約しSlackにHTMLリンク+モーダルを埋め込むワークフロー

**対象**: `POST /webhook/github` から始まるAI要約パイプライン、`buildSlackMessage()` によるSlack通知、
`buildSummaryModal()` によるSlackモーダル表示、`GET /ai-summary/:id` によるHTML詳細ページ
— PRイベントをトリガーにWorkers AIで要約を生成し、Slack通知（2ボタン）・モーダル表示・HTML詳細ページの
3つの表示経路でユーザーに提供するワークフロー。**完成度: 8割**。

### 背景

- PRが作成・更新されるとWebhookでWorkerが起動し、Workers AIがdiffを要約してD1に保存する
- 要約結果はSlackに通知され、ユーザーはSlack内モーダルまたはHTML詳細ページで閲覧できる
- 当初はSlack通知にボタンが1つ（モーダルのみ）だったが、モーダルは狭く読みにくいためHTML版を追加
- HTML版のリンク先ドメインの誤り（`nekoserver` → `nekoflare`）が長期間気づかれず404が続いた

### 現在の仕様

#### Slack通知メッセージ（`buildSlackMessage`）

- 正常要約時: AI要約をコードブロックで表示し、2つのボタンを配置
  - 「モーダルで詳細」: `action_id=view_ai_summary_detail` でモーダルを開く
  - 「詳細を見る(HTML版)」: `action_id=open_ai_summary_html` + `url` でHTML詳細ページを直接開く
- `[AI_*]` エラー時: `:warning: AI要約エラー:` セクションでエラー内容を表示（握りつぶし禁止）
- 罫線文字（`├└│─`等）は `sanitizeBoxDrawing()` で箇条書きに変換

#### Slackモーダル（`buildSummaryModal`）

- `views.open` で表示するモーダル
- **制約: モーダル内に `actions` ブロックを配置してはならない**（`url` 付きボタンがモーダルでは動作しない。メッセージでは動作する）
- HTMLで表示リンクは `context` ブロック内の mrkdwn リンク（`<URL|テキスト>`）で提供
- タイトル: 「要約を表示」（24文字以下制約）

#### HTML詳細ページ（`GET /ai-summary/:id`）

- D1の `ai_summary_log` からレコードを取得し、サーバーサイドでHTMLを生成
- ダークモード（背景 `#1a1a2e`、テキスト `#e0e0e0`）
- ヘッダ（メタ情報）は `<details>` で折りたたみ済み、要約テキストが最初に見える
- レビュー情報がある場合はテーブルで表示
- 認証不要（公開エンドポイント）

#### セッション管理（`renewSession`）

- セッション有効期限を変更した際、JWT を即時再発行し Cookie を書き換える（再ログイン不要）

### 未完成・今後の課題

- Issue との連動（どの時点のコミットがどの Issue に対して効果があったかの検証）
- HTML詳細ページのさらなる拡張（diff表示、コミット履歴連携等）
- `WORKER_BASE_URL` の環境変数化（現在はハードコード。本番移行時に対応予定）

### 実証済みの制約事項（テストで保証）

| 制約 | 理由 | テストファイル |
|---|---|---|
| モーダル内に `actions` ブロック禁止 | `url` 付きボタンがモーダルで動作しない | `aiSummary.test.ts` |
| モーダル内リンクは mrkdwn 形式のみ | `context` ブロック内の `<URL\|text>` | `aiSummary.test.ts` |
| メッセージに2ボタン必須 | 「モーダルで詳細」+「詳細を見る(HTML版)」 | `aiSummary.test.ts` |
| `[AI_*]` エラーは必ず表示 | 4パターン全てで `:warning:` 表示を検証 | `aiSummary.test.ts` |
| `/ai-summary/:id` が200+HTMLを返す | ルート統合テスト | `ai-summary.test.ts` |
| モーダルURL → ルート到達の保証チェーン | URL抽出 → リクエスト → 200確認 | `ai-summary.test.ts` |

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/utils/aiSummary.ts` | `buildSlackMessage` に2ボタン追加、`buildSummaryModal` のリンクをmrkdwn化、AIエラー表示、`WORKER_BASE_URL` ドメイン修正 |
| `src/utils/session.ts` | `getSessionDurationSeconds()` と `renewSession()` を新規作成 |
| `src/index.ts` | `/ai-summary/:id` HTML詳細ページ（ダークモード、メタ情報折りたたみ）、セッション即時再発行 |
| `src/utils/slackInteraction.ts` | `open_ai_summary_html` アクションのskip処理 |
| `CLAUDE.md` | Workerドメイン運用ポリシー追記 |

### 関連コミット

- [`f377daf`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f377daf) fix: AIエラー時にSlack通知でエラー内容を表示し管理者に修正を促す
- [`cff1045`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/cff1045) fix: セッション時間変更時にJWT即時再発行 & AIエラーのSlack通知
- [`ef7c934`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ef7c934) docs: Workerドメイン運用ポリシーを追加
- [`ced7efc`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ced7efc) fix: SlackメッセージにHTMLで表示ボタンを追加（2ボタン構成に復元）
- [`4ad6e02`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4ad6e02) fix: モーダル内HTMLで表示をmrkdwnリンクに変更（urlボタンはモーダルで動作しない）
- [`d9d6118`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d9d6118) test: Slack制約テストを実証済み事実に基づいて書き直し
- [`2324538`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2324538) test: /ai-summary/:id ルート統合テストと保証チェーンテストを追加
- [`7b6b21f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7b6b21f) style: AI要約HTMLページをダークモードに変更
- [`809b5f2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/809b5f2) fix: WORKER_BASE_URLのドメインを nekoserver → nekoflare に修正
- [`390c6f6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/390c6f6) fix: Slackメッセージのボタン表記を変更
- [`bab4e5b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/bab4e5b) style: AI要約HTMLのヘッダ(メタ情報)をdetailsで折りたたみ

### 注意事項

- `WORKER_BASE_URL` は現在 `https://cloudflare-workers-github-oauth-1.nekoflare.workers.dev` にハードコード。本番移行時は環境変数で上書きする想定
- Slackメッセージの `url` 付きボタンはメッセージでのみ動作し、モーダルでは動作しない。この差異は実証済みでテストで保護されている
- `GITHUB_CLIENT_ID` 等の秘密情報は `wrangler secret` で管理。`wrangler.toml` の `[vars]` には書かない
