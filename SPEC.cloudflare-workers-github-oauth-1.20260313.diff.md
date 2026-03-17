--- SPEC.cloudflare-workers-github-oauth.latest.md	2026-03-13 04:15:16.672871469 +0900
+++ SPEC.cloudflare-workers-github-oauth-1.20260313.md	2026-03-13 11:38:30.202951563 +0900
@@ -31,7 +31,9 @@
 │   │   ├── github.ts             # GitHub API クライアント
 │   │   ├── cookie.ts             # Cookie解析ユーティリティ
 │   │   ├── html.ts               # HTMLエスケープ (XSS対策)
-│   │   └── logger.ts             # 構造化ログ・Analytics Engine記録
+│   │   ├── logger.ts             # 構造化ログ・Analytics Engine記録
+│   │   ├── resendWebhook.ts      # Resend webhook署名検証 (Svix)
+│   │   └── slack.ts              # Slack通知 (chat.postMessage)
 │   └── views/
 │       ├── login.ts              # ログインページHTML
 │       ├── welcome.ts            # ウェルカムページHTML
@@ -93,6 +95,35 @@
 | `/api/profile` | PUT | 必須 | 表示名更新 (D1に保存) |
 | `/api/settings/timezone` | POST | 必須 | タイムゾーン変更 (JST/UTC、デフォルトJST) |
 | `/api/settings/session-duration` | POST | 必須 | セッション有効期限変更 |
+| `/webhook/resend` | POST | - | Resend webhook受信 (署名検証 + オリジン通知 + Slack通知) |
+
+---
+
+## Webhook: Resend
+
+### 受信
+
+- エンドポイント: `POST /webhook/resend`
+- 署名検証: `svix-id`, `svix-timestamp`, `svix-signature` を利用して `RESEND_WEBHOOK_SECRET` で検証
+- 無効な署名は `401`、JSON不正は `400` を返す
+
+### オリジン通知
+
+- 受信イベントの `type` を `event` クエリに乗せてオリジンへGET通知
+- 通知先: `https://mynw.nekomaneki.work/lib/resend-webhook.shtml?event=<type>`
+- 失敗時は `502` を返す
+
+### Slack通知
+
+- Slack通知は「送信結果が確定するイベントのみ」送信する
+- `email.delivered` は `送信完了` として通知する
+- `email.failed` と `email.bounced` は `失敗` として通知する
+- `email.sent` など送信前イベントでは通知しない
+- 投稿内容は以下の4行構成
+- `Resend: <送信完了|失敗>`
+- `from: <from>`
+- `to: <to>`
+- `件名: <subject>`
 
 ---
 
@@ -201,6 +232,12 @@
 | `JWT_SECRET` | 必須 | JWT署名用シークレットキー |
 | `GITHUB_CLIENT_ID` | 必須 | GitHub OAuth App クライアントID |
 | `GITHUB_CLIENT_SECRET` | 必須 | GitHub OAuth App クライアントシークレット |
+| `RESEND_WEBHOOK_SECRET` | 必須 | Resend webhook署名検証用シークレット |
+| `SLACK_SIGNING_SECRET` | 必須 | Slack App署名検証用シークレット |
+| `SLACK_OAUTH_TOKEN` | 必須 | Slack Bot OAuth Token |
+| `SLACK_CLIENT_SECRET` | 必須 | Slack App Client Secret |
+| `SLACK_CLIENT_ID` | 必須 | Slack App Client ID |
+| `SLACK_CHANNEL_ID` | 必須 | Slack通知先チャンネルID |
 
 ### 環境変数 (`wrangler.toml` [vars])
 
