# API リファレンス: cloudflare-workers-github-oauth-1

最終更新: 2026-09-24

---

## エンドポイント一覧

### ページ（HTML）

| メソッド | パス | 認証 | 説明 | ビューファイル | 最終コミット |
|---|---|---|---|---|---|
| GET | `/` | 不要 | ログインページ | `src/views/login.ts` | [`ea91d8f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ea91d8f) 2026-03-07 |
| GET | `/welcome` | 必須 | ウェルカムページ | `src/views/welcome.ts` | [`c3f20e1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c3f20e1) 2026-03-14 |
| GET | `/settings` | 必須 | 設定ページ | `src/views/settings.ts` | [`a0e5e49`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a0e5e49) 2026-03-16 |
| GET | `/repositories` | 任意 | リポジトリ一覧 | `src/views/repositories.ts` | [`1a8bf0c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1a8bf0c) 2026-03-16 |

### 認証フロー

| メソッド | パス | 認証 | 説明 | 最終コミット |
|---|---|---|---|---|
| GET | `/auth/github` | 不要 | GitHub OAuth 開始（GitHubへリダイレクト） | [`ba4cbc1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ba4cbc1) 2026-03-16 |
| GET | `/github/callback` | 不要 | OAuth コールバック / Install App コールバック | [`ba4cbc1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ba4cbc1) 2026-03-16 |
| GET | `/auth/github/reauthorize` | 必須 | 既存グラント取消 → 再認証 | [`3abcd07`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3abcd07) 2026-03-16 |
| GET | `/auth/logout` | 不要 | ログアウト（Cookie削除 → `/` へリダイレクト） | [`ea91d8f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ea91d8f) 2026-03-07 |

### API（JSON）

| メソッド | パス | 認証 | 説明 | 最終コミット |
|---|---|---|---|---|
| GET | `/health` | 不要 | ヘルスチェック | [`ea91d8f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ea91d8f) 2026-03-07 |
| GET | `/api` | 不要 | API情報・エンドポイント一覧 | [`ea91d8f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ea91d8f) 2026-03-07 |
| GET | `/api/public` | 任意 | 公開エンドポイント（認証有無で応答変化） | [`ea91d8f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ea91d8f) 2026-03-07 |
| GET | `/api/protected` | 必須 | 認証確認用エンドポイント | [`ea91d8f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ea91d8f) 2026-03-07 |
| GET | `/api/profile` | 必須 | ユーザープロフィール取得 | [`ea91d8f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ea91d8f) 2026-03-07 |
| PUT | `/api/profile` | 必須 | 表示名の更新（D1） | [`ea91d8f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ea91d8f) 2026-03-07 |
| POST | `/api/settings/timezone` | 必須 | タイムゾーン変更（D1 + Cookie） | [`207441d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/207441d) 2026-03-14 |
| POST | `/api/settings/session-duration` | 必須 | セッション有効期限変更（D1 + Cookie） | [`207441d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/207441d) 2026-03-14 |
| GET | `/api/repo-permissions` | 必須 | インストール権限の最新データ取得（D1優先、APIフォールバック） | [`688c22b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/688c22b) 2026-03-16 |

### Webhook（受信）

| メソッド | パス | 認証 | 説明 | 最終コミット |
|---|---|---|---|---|
| POST | `/webhook/github` | HMAC-SHA256 署名検証 | GitHub App installation イベント受信 → D1保存 + Slack通知 | [`688c22b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/688c22b) 2026-03-16 |
| POST | `/webhook/cf-auth` | HMAC-SHA256 署名検証 | cf-auth のログイン等のイベント受信 → ユーザー判定 + Slack通知 | `src/index.ts` |
| POST | `/webhook/resend` | Svix 署名検証 | Resend メール配信イベント受信 → Slack通知 + プロキシ転送 | [`d2b2898`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d2b2898) 2026-03-13 |

### デバッグ用

| メソッド | パス | 認証 | 説明 | 用途 | 最終コミット |
|---|---|---|---|---|---|
| GET | `/api/debug/d1` | 必須 | D1 接続診断 | テーブル存在・カラム・レコード確認・テスト書き込み | [`c98a14d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c98a14d) 2026-03-16 |
| GET | `/api/debug/installations` | 必須 | GitHub App インストール診断 | API生レスポンス・権限マップ・リポジトリ紐付け確認 | [`f66113d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f66113d) 2026-03-16 |

---

## Webhook

### cf-auth Webhook

| メソッド | パス | 認証 | 定義箇所 |
|---|---|---|---|
| POST | `/webhook/cf-auth` | `CF_AUTH_WEBHOOK_SECRET` による HMAC-SHA256 署名検証（`X-Hub-Signature-256`） | `src/index.ts` |

`Authorization` ヘッダーはこのエンドポイントの認証には使用しない。送信側は、送信時の JSON 文字列そのもの（UTF-8）を `CF_AUTH_WEBHOOK_SECRET` を鍵として HMAC-SHA256 で署名し、16進小文字の署名を `X-Hub-Signature-256: sha256=<hex>` 形式で付与する。署名計算後に JSON の再整形・改行追加・文字コード変換が行われると、受信した生の本文との署名照合に失敗する。

### GitHub App Webhook

| メソッド | パス | 認証 | 定義箇所 |
|---|---|---|---|
| POST | `/webhook/github` | HMAC-SHA256 署名検証（`X-Hub-Signature-256`） | `src/index.ts` |

#### 処理フロー

```
GitHub → POST /webhook/github
  ├─ HMAC-SHA256 署名検証（X-Hub-Signature-256）
  ├─ イベント種別判定（X-GitHub-Event ヘッダー）
  ├─ installation / installation_repositories イベントの処理
  │   ├─ created / new_permissions_accepted / unsuspend → D1 に UPSERT
  │   ├─ deleted / suspend → D1 から DELETE
  │   └─ repositories_added / repositories_removed → リポジトリ単位で挿入/削除
  └─ Slack 通知（インストール変更の概要）
```

#### 処理するイベント

| X-GitHub-Event | action | D1 操作 | Slack通知 |
|---|---|---|---|
| `installation` | `created` | UPSERT | インストール |
| `installation` | `deleted` | DELETE | アンインストール |
| `installation` | `suspend` | DELETE | 一時停止 |
| `installation` | `unsuspend` | UPSERT | 再開 |
| `installation` | `new_permissions_accepted` | UPSERT | 権限変更承認 |
| `installation_repositories` | `added` | UPSERT（リポジトリ単位） | - |
| `installation_repositories` | `removed` | DELETE（リポジトリ単位） | - |

#### 必要な環境変数

| 変数名 | 用途 | 管理方法 |
|---|---|---|
| `GITHUB_WEBHOOK_SECRET` | Webhook 署名検証用シークレット | `wrangler secret` |

#### 検証ユーティリティ

| 関数名 | 定義ファイル | 説明 |
|---|---|---|
| `verifyGitHubWebhookSignature` | `src/utils/githubWebhook.ts` | HMAC-SHA256 による GitHub Webhook 署名検証（タイミングセーフ比較） |

### Resend Webhook

| メソッド | パス | 認証 | 定義箇所 | 最終コミット |
|---|---|---|---|---|
| POST | `/webhook/resend` | Svix 署名検証 | `src/index.ts` | [`d2b2898`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d2b2898) 2026-03-13 |

#### 処理フロー

```
Resend → POST /webhook/resend
  ├─ Svix 署名検証（svix-id, svix-timestamp, svix-signature）
  ├─ 重複排除（svix-id ベース、インメモリ Map、TTL設定可能）
  ├─ イベント種別の判定
  │   ├─ email.delivered → Slack通知「送信完了」
  │   ├─ email.failed    → Slack通知「失敗」
  │   └─ email.bounced   → Slack通知「失敗」
  ├─ Slack通知（該当イベントのみ）
  └─ 外部プロキシへGET転送
```

#### 必要な環境変数

| 変数名 | 用途 | 管理方法 |
|---|---|---|
| `RESEND_WEBHOOK_SECRET` | Svix 署名検証用シークレット | `wrangler secret` |
| `RESEND_WEBHOOK_DEDUP_TTL_SECONDS` | 重複排除の有効期間（デフォルト: 600秒） | `wrangler.toml [vars]` or `wrangler secret` |

#### 検証ユーティリティ

| 関数名 | 定義ファイル | 説明 |
|---|---|---|
| `verifyResendWebhookSignature` | `src/utils/resendWebhook.ts` | HMAC-SHA256 による Svix 署名検証（タイミングセーフ比較、±5分のタイムスタンプ許容） |

---

## GitHub 連携

### GitHub OAuth フロー

```
ユーザー → GET /auth/github
  ├─ state (CSRF) + PKCE 生成 → Cookie 保存
  └─ GitHub /login/oauth/authorize へリダイレクト

GitHub → GET /github/callback?code=...&state=...
  ├─ state 検証（CSRF対策）
  ├─ getGitHubAccessToken()  → POST github.com/login/oauth/access_token
  ├─ getGitHubUser()         → GET api.github.com/user
  ├─ getGitHubUserEmail()    → GET api.github.com/user/emails
  ├─ D1にセッション保存
  ├─ JWT生成 → auth_token Cookie
  └─ /welcome へリダイレクト

GitHub → GET /github/callback?setup_action=install
  └─ Install App コールバック（state検証スキップ、リダイレクトのみ）
```

#### 要求スコープ

```
read:user user:email repo
```

### GitHub API 呼び出し一覧

| 関数名 | メソッド | エンドポイント | 認証方式 | 呼び出し元 | 定義ファイル |
|---|---|---|---|---|---|
| `getGitHubAccessToken` | POST | `github.com/login/oauth/access_token` | client_id + client_secret | `/github/callback` | `src/utils/github.ts` |
| `getGitHubUser` | GET | `api.github.com/user` | Bearer token | `/github/callback` | `src/utils/github.ts` |
| `getGitHubUserEmail` | GET | `api.github.com/user/emails` | Bearer token | `/github/callback` | `src/utils/github.ts` |
| `getGitHubUserRepos` | GET | `api.github.com/user/repos` or `/users/{name}/repos` | Bearer token（任意） | `/repositories` | `src/utils/github.ts` |
| `getGitHubLatestCommit` | GET | `api.github.com/repos/{owner}/{repo}/commits?per_page=1` | Bearer token（任意） | `/repositories` | `src/utils/github.ts` |
| `getGitHubTokenScopes` | POST | `api.github.com/applications/{clientId}/token` | Basic (clientId:clientSecret) | `/settings`, `/repositories` | `src/utils/github.ts` |
| `getGitHubUserInstallationsWithDiag` | GET | `api.github.com/user/installations` | Bearer token | `/repositories`※1, `/api/repo-permissions`※1, `/api/debug/installations` | `src/utils/github.ts` |
| `getGitHubInstallationRepos` | GET | `api.github.com/user/installations/{id}/repositories` | Bearer token | `/repositories`※1, `/api/repo-permissions`※1, `/api/debug/installations` | `src/utils/github.ts` |

※1 D1 にデータがない場合のフォールバックとしてのみ呼び出される（D1 にデータがある場合は GitHub API を呼ばない）
| (直接fetch) | DELETE | `api.github.com/applications/{clientId}/grant` | Basic (clientId:clientSecret) | `/auth/github/reauthorize` | `src/index.ts` L522 |

### GitHub API 共通ヘッダー

全インストール系 API 呼び出しに適用（`githubApiHeaders` 関数）:

| ヘッダー | 値 |
|---|---|
| `Accept` | `application/vnd.github+json` |
| `X-GitHub-Api-Version` | `2022-11-28` |
| `User-Agent` | `Cloudflare-Workers-GitHub-OAuth` |

---

## Slack 連携

### 現在の実装

| 関数名 | メソッド | エンドポイント | 定義ファイル | 最終コミット |
|---|---|---|---|---|
| `postSlackMessage` | POST | `https://slack.com/api/chat.postMessage` | `src/utils/slack.ts` | [`c155d7d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c155d7d) 2026-03-13 |

#### 現在の通知タイミング

| トリガー | イベント種別 | 通知内容 | 優先度 |
|---|---|---|---|
| Resend Webhook | `email.delivered` | 「送信完了」+ from / to / 件名 | 中 |
| Resend Webhook | `email.failed` | 「失敗」+ from / to / 件名 | 中 |
| Resend Webhook | `email.bounced` | 「失敗」+ from / to / 件名 | 中 |
| OAuth コールバック失敗 | ログイン失敗 | 「ログイン失敗」+ エラー内容 + IP | 高 |
| JWT 検証失敗 | 不審アクセス | 「無効なJWTトークンによるアクセス試行」+ パス + IP | 高 |
| GitHub Webhook | `installation` 各アクション | 「GitHub App インストール/アンインストール/権限変更」+ 操作者 + 対象 | 中〜高 |

#### 必要な環境変数

| 変数名 | 用途 | 管理方法 |
|---|---|---|
| `SLACK_OAUTH_TOKEN` | Bot トークン（`xoxb-...`） | `wrangler secret` |
| `SLACK_CHANNEL_ID` | 通知先チャンネル ID | `wrangler secret` |
| `SLACK_SIGNING_SECRET` | Slack署名検証用（現在未使用） | `wrangler secret` |
| `SLACK_CLIENT_ID` | SlackアプリClient ID（現在未使用） | `wrangler secret` |
| `SLACK_CLIENT_SECRET` | SlackアプリClient Secret（現在未使用） | `wrangler secret` |

### Slack 通知の実装状況と追加提案

| タイミング | トリガー箇所 | 通知内容 | 優先度 | 状態 |
|---|---|---|---|---|
| **ログイン失敗** | `/github/callback` catch節 | 「ログイン失敗」+ エラー内容 + IP | 高 | 実装済み ([`688c22b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/688c22b)) |
| **不審なアクセス** | `authMiddleware` JWT検証失敗時 | 「無効なJWTトークンによるアクセス試行」+ パス + IP + ソース | 高 | 実装済み ([`688c22b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/688c22b)) |
| **GitHub App 権限変更 Webhook** | `POST /webhook/github` | 「GitHub App インストール/アンインストール/権限変更」+ 操作者 + 対象 | 高 | 実装済み ([`688c22b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/688c22b)) |
| **ログイン成功** | `/github/callback` JWT発行後 | 「{user} がログインしました」 | 中 | 未実装 |
| **再認証実行** | `/auth/github/reauthorize` | 「{user} が権限の再認証を実行しました」 | 低 | 未実装 |
| **権限変更検知** | `/api/repo-permissions` 差分発生時 | 「{user} のインストール権限に変更がありました」 | 中 | 未実装（Webhook実装により優先度低下） |
| **GitHub App インストール（コールバック経由）** | `/github/callback?setup_action=install` | 「GitHub App がインストールされました」 | 中 | 未実装（Webhook側で通知済みのため重複） |
| **APIレート制限接近** | GitHub API 呼び出し時 `X-RateLimit-Remaining` チェック | 「GitHub APIレート制限残り {n} 回」 | 中 | 未実装 |

#### 実装時の推奨事項

- **通知過多に注意**: ログイン成功は頻度が高いため、同一ユーザーの連続ログインは抑制（例: 同一ユーザー30分以内は2回目以降を省略）
- Webhook 実装により「権限変更検知」と「GitHub App インストール（コールバック経由）」の優先度は低下

---

## 環境変数一覧

| 変数名 | 用途 | 管理方法 | 使用箇所 |
|---|---|---|---|
| `JWT_SECRET` | JWT 署名・検証 | `wrangler secret` | `src/index.ts`, `src/middleware/auth.ts` |
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID | `wrangler secret` | `src/index.ts` |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret | `wrangler secret` | `src/index.ts` |
| `GITHUB_WEBHOOK_SECRET` | GitHub App Webhook 署名検証 | `wrangler secret` | `src/index.ts` (`POST /webhook/github`) |
| `RESEND_WEBHOOK_SECRET` | Resend Svix 署名検証 | `wrangler secret` | `src/index.ts` (`POST /webhook/resend`) |
| `RESEND_WEBHOOK_DEDUP_TTL_SECONDS` | Resend 重複排除 TTL（デフォルト: 600秒） | `wrangler.toml [vars]` or `wrangler secret` | `src/index.ts` |
| `SLACK_OAUTH_TOKEN` | Slack Bot トークン（`xoxb-...`） | `wrangler secret` | `src/utils/slack.ts`, `src/middleware/auth.ts` |
| `SLACK_CHANNEL_ID` | Slack 通知先チャンネル ID | `wrangler secret` | `src/index.ts`, `src/middleware/auth.ts` |
| `SLACK_SIGNING_SECRET` | Slack 署名検証（現在未使用） | `wrangler secret` | - |
| `SLACK_CLIENT_ID` | Slack App Client ID（現在未使用） | `wrangler secret` | - |
| `SLACK_CLIENT_SECRET` | Slack App Client Secret（現在未使用） | `wrangler secret` | - |
| `SESSION_IDLE_TIMEOUT_SECONDS` | アイドルタイムアウト秒数 | `wrangler.toml [vars]` or `wrangler secret` | `src/index.ts`, `src/middleware/auth.ts` |
| `ENVIRONMENT` | 実行環境識別子 | `wrangler.toml [vars]` | `src/index.ts` |

---

## その他外部連携

| 関数/呼び出し | メソッド | エンドポイント | 呼び出し元 | 定義ファイル | 最終コミット |
|---|---|---|---|---|---|
| (直接fetch) | GET | `https://mynw.nekomaneki.work/lib/resend-webhook.shtml?event={type}` | `/webhook/resend` | `src/index.ts` | [`d2b2898`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d2b2898) 2026-03-13 |

---

## ソースファイル一覧

### アプリケーション

| ファイル | 役割 | 最終コミット | 日時 |
|---|---|---|---|
| `src/index.ts` | ルートハンドラ・ビジネスロジック（Webhook含む） | [`688c22b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/688c22b) | 2026-03-16 |
| `src/middleware/auth.ts` | JWT 認証ミドルウェア（検証失敗時Slack通知） | [`688c22b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/688c22b) | 2026-03-16 |

### ビュー

| ファイル | 役割 | 最終コミット | 日時 |
|---|---|---|---|
| `src/views/login.ts` | ログインページ HTML | [`ea91d8f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ea91d8f) | 2026-03-07 14:37 |
| `src/views/welcome.ts` | ウェルカムページ HTML | [`c3f20e1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c3f20e1) | 2026-03-14 22:22 |
| `src/views/settings.ts` | 設定ページ HTML | [`a0e5e49`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a0e5e49) | 2026-03-16 02:07 |
| `src/views/repositories.ts` | リポジトリ一覧ページ HTML | [`1a8bf0c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1a8bf0c) | 2026-03-16 10:19 |

### ユーティリティ

| ファイル | 役割 | 最終コミット | 日時 |
|---|---|---|---|
| `src/utils/github.ts` | GitHub API ユーティリティ | [`f66113d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f66113d) | 2026-03-16 10:37 |
| `src/utils/jwt.ts` | JWT 生成・検証 | [`e08a15b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e08a15b) | 2026-03-14 23:09 |
| `src/utils/cookie.ts` | Cookie パース | [`ea91d8f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ea91d8f) | 2026-03-07 14:37 |
| `src/utils/html.ts` | HTML エスケープ | [`ea91d8f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ea91d8f) | 2026-03-07 14:37 |
| `src/utils/logger.ts` | ロガー・Analytics | [`ea91d8f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ea91d8f) | 2026-03-07 14:37 |
| `src/utils/resendWebhook.ts` | Resend Webhook 署名検証 | [`d2b8c0d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d2b8c0d) | 2026-03-12 19:32 |
| `src/utils/githubWebhook.ts` | GitHub Webhook 署名検証 | [`688c22b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/688c22b) | 2026-03-16 |
| `src/utils/slack.ts` | Slack メッセージ送信 | [`c155d7d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c155d7d) | 2026-03-13 02:15 |

### マイグレーション

| ファイル | 内容 | 最終コミット | 日時 |
|---|---|---|---|
| `migrations/0001_create_user_sessions.sql` | `user_sessions` テーブル作成 | [`ea91d8f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ea91d8f) | 2026-03-07 |
| `migrations/0002_add_display_name.sql` | `display_name` カラム追加 | [`ea91d8f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ea91d8f) | 2026-03-07 |
| `migrations/0003_add_github_access_token.sql` | `github_access_token` カラム追加 | [`e5a4763`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e5a4763) | 2026-03-16 |
| `migrations/0004_create_installation_permissions.sql` | `installation_permissions` テーブル作成 | [`688c22b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/688c22b) | 2026-03-16 |

---

## D1 データベーススキーマ

### `user_sessions` テーブル

| カラム | 型 | デフォルト | マイグレーション |
|---|---|---|---|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | - | 0001 |
| `user_id` | TEXT NOT NULL UNIQUE | - | 0001 |
| `timezone` | TEXT | `'JST'` | 0001 |
| `session_duration` | TEXT | `'1h'` | 0001 |
| `last_login_at` | TEXT | NULL | 0001 |
| `current_login_at` | TEXT NOT NULL | - | 0001 |
| `updated_at` | TEXT NOT NULL | - | 0001 |
| `display_name` | TEXT | NULL | 0002 |
| `github_access_token` | TEXT | NULL | 0003 |

### `installation_permissions` テーブル

| カラム | 型 | デフォルト | マイグレーション |
|---|---|---|---|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | - | 0004 |
| `installation_id` | INTEGER NOT NULL | - | 0004 |
| `repo_name` | TEXT | NULL | 0004 |
| `repository_selection` | TEXT NOT NULL | `'selected'` | 0004 |
| `permissions` | TEXT NOT NULL | `'{}'` | 0004 |
| `updated_at` | TEXT NOT NULL | - | 0004 |

**インデックス:**
- `idx_install_perm_repo`: UNIQUE ON (`installation_id`, `repo_name`)
- `idx_install_perm_updated`: ON (`updated_at`)

---

## 認証方式

| 表記 | ミドルウェア | 挙動 |
|---|---|---|
| **必須** | `authMiddleware` | JWT 未検証で 401。検証失敗時は Slack にセキュリティ警告を送信 |
| **任意** | `optionalAuthMiddleware` | JWT があれば検証、なくても通過 |
| **不要** | なし | 認証チェックなし |
| **Svix 署名検証** | なし（ハンドラ内で検証） | Svix 署名ヘッダー（`svix-id`, `svix-timestamp`, `svix-signature`）で検証 |
| **HMAC-SHA256 署名検証** | なし（ハンドラ内で検証） | `X-Hub-Signature-256` ヘッダーで HMAC-SHA256 署名を検証 |

---

## `/repositories` のデータフロー

```
ページ読み込み (GET /repositories)
  ├─ サーバーサイド
  │   ├─ getGitHubTokenScopes()          → OAuthスコープ取得
  │   ├─ getInstallationPermissionsFromD1()  → D1 から権限読み取り（高速）
  │   │   └─ D1 にデータなし → buildRepoInstallationPermissionsMap() でAPI フォールバック
  │   ├─ getGitHubUserRepos()            → リポジトリ一覧取得
  │   └─ getGitHubLatestCommit()         → 各リポジトリの最新コミット
  │
  └─ クライアントサイド（DOMContentLoaded後）
      └─ fetch('/api/repo-permissions')  → 最新インストール権限を取得（D1優先）
          └─ 差分があれば repoPermsData を更新
```

### 権限データの取得優先順位

1. **D1 (Webhook経由)** — `installation_permissions` テーブルから読み取り。Webhookで自動更新されるためリアルタイム
2. **GitHub API (フォールバック)** — D1にデータがない場合、`buildRepoInstallationPermissionsMap()` で GitHub API から取得
