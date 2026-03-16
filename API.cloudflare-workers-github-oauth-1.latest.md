# API リファレンス: cloudflare-workers-github-oauth-1

最終更新: 2026-03-16

---

## エンドポイント一覧

### ページ（HTML）

| メソッド | パス | 認証 | 説明 | ビューファイル | 最終コミット |
|---|---|---|---|---|---|
| GET | `/` | 不要 | ログインページ | `src/views/login.ts` | `ea91d8f` 2026-03-07 |
| GET | `/welcome` | 必須 | ウェルカムページ | `src/views/welcome.ts` | `c3f20e1` 2026-03-14 |
| GET | `/settings` | 必須 | 設定ページ | `src/views/settings.ts` | `a0e5e49` 2026-03-16 |
| GET | `/repositories` | 任意 | リポジトリ一覧 | `src/views/repositories.ts` | `1a8bf0c` 2026-03-16 |

### 認証フロー

| メソッド | パス | 認証 | 説明 | 最終コミット |
|---|---|---|---|---|
| GET | `/auth/github` | 不要 | GitHub OAuth 開始（GitHubへリダイレクト） | `ba4cbc1` 2026-03-16 |
| GET | `/github/callback` | 不要 | OAuth コールバック / Install App コールバック | `ba4cbc1` 2026-03-16 |
| GET | `/auth/github/reauthorize` | 必須 | 既存グラント取消 → 再認証 | `3abcd07` 2026-03-16 |
| GET | `/auth/logout` | 不要 | ログアウト（Cookie削除 → `/` へリダイレクト） | `ea91d8f` 2026-03-07 |

### API（JSON）

| メソッド | パス | 認証 | 説明 | 最終コミット |
|---|---|---|---|---|
| GET | `/health` | 不要 | ヘルスチェック | `ea91d8f` 2026-03-07 |
| GET | `/api` | 不要 | API情報・エンドポイント一覧 | `ea91d8f` 2026-03-07 |
| GET | `/api/public` | 任意 | 公開エンドポイント（認証有無で応答変化） | `ea91d8f` 2026-03-07 |
| GET | `/api/protected` | 必須 | 認証確認用エンドポイント | `ea91d8f` 2026-03-07 |
| GET | `/api/profile` | 必須 | ユーザープロフィール取得 | `ea91d8f` 2026-03-07 |
| PUT | `/api/profile` | 必須 | 表示名の更新（D1） | `ea91d8f` 2026-03-07 |
| POST | `/api/settings/timezone` | 必須 | タイムゾーン変更（D1 + Cookie） | `207441d` 2026-03-14 |
| POST | `/api/settings/session-duration` | 必須 | セッション有効期限変更（D1 + Cookie） | `207441d` 2026-03-14 |
| GET | `/api/repo-permissions` | 必須 | インストール権限の最新データ取得 | `1a8bf0c` 2026-03-16 |

### デバッグ用

| メソッド | パス | 認証 | 説明 | 用途 | 最終コミット |
|---|---|---|---|---|---|
| GET | `/api/debug/d1` | 必須 | D1 接続診断 | テーブル存在・カラム・レコード確認・テスト書き込み | `c98a14d` 2026-03-16 |
| GET | `/api/debug/installations` | 必須 | GitHub App インストール診断 | API生レスポンス・権限マップ・リポジトリ紐付け確認 | `f66113d` 2026-03-16 |

---

## Webhook

### Resend Webhook

| メソッド | パス | 認証 | 定義箇所 | 最終コミット |
|---|---|---|---|---|
| POST | `/webhook/resend` | Svix 署名検証 | `src/index.ts` L842 | `d2b2898` 2026-03-13 |

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
| `getGitHubUserInstallationsWithDiag` | GET | `api.github.com/user/installations` | Bearer token | `/repositories`, `/api/repo-permissions`, `/api/debug/installations` | `src/utils/github.ts` |
| `getGitHubInstallationRepos` | GET | `api.github.com/user/installations/{id}/repositories` | Bearer token | `/repositories`, `/api/repo-permissions`, `/api/debug/installations` | `src/utils/github.ts` |
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
| `postSlackMessage` | POST | `https://slack.com/api/chat.postMessage` | `src/utils/slack.ts` | `c155d7d` 2026-03-13 |

#### 現在の通知タイミング

| トリガー | イベント種別 | 通知内容 |
|---|---|---|
| Resend Webhook | `email.delivered` | 「送信完了」+ from / to / 件名 |
| Resend Webhook | `email.failed` | 「失敗」+ from / to / 件名 |
| Resend Webhook | `email.bounced` | 「失敗」+ from / to / 件名 |

#### 必要な環境変数

| 変数名 | 用途 | 管理方法 |
|---|---|---|
| `SLACK_OAUTH_TOKEN` | Bot トークン（`xoxb-...`） | `wrangler secret` |
| `SLACK_CHANNEL_ID` | 通知先チャンネル ID | `wrangler secret` |
| `SLACK_SIGNING_SECRET` | Slack署名検証用（現在未使用） | `wrangler secret` |
| `SLACK_CLIENT_ID` | SlackアプリClient ID（現在未使用） | `wrangler secret` |
| `SLACK_CLIENT_SECRET` | SlackアプリClient Secret（現在未使用） | `wrangler secret` |

### Slack 通知の追加タイミング提案

現在は Resend Webhook 経由のメール配信結果のみだが、以下のタイミングでも通知があると運用上有用:

| タイミング | トリガー箇所 | 通知内容案 | 優先度 |
|---|---|---|---|
| **ログイン成功** | `/github/callback` JWT発行後 | 「{user} がログインしました」 | 中 |
| **ログイン失敗** | `/github/callback` catch節 | 「GitHub認証エラー: {error}」 | 高 |
| **再認証実行** | `/auth/github/reauthorize` | 「{user} が権限の再認証を実行しました」 | 低 |
| **権限変更検知** | `/api/repo-permissions` 差分発生時 | 「{user} のインストール権限に変更がありました」 | 中 |
| **GitHub App インストール** | `/github/callback?setup_action=install` | 「GitHub App がインストールされました (installation_id: {id})」 | 高 |
| **GitHub App 権限変更 Webhook** | 新設 `POST /webhook/github` | 「GitHub App の権限が変更されました」※要Webhook設定 | 高 |
| **不審なアクセス** | `authMiddleware` JWT検証失敗時 | 「不正なJWTによるアクセス試行: {path}」 | 高 |
| **APIレート制限接近** | GitHub API 呼び出し時 `X-RateLimit-Remaining` チェック | 「GitHub APIレート制限残り {n} 回」 | 中 |

#### 実装時の推奨事項

- **優先度「高」から着手**: ログイン失敗・App インストール・不審アクセスは運用上すぐ知りたい情報
- **通知過多に注意**: ログイン成功は頻度が高いため、同一ユーザーの連続ログインは抑制（例: 同一ユーザー30分以内は2回目以降を省略）
- **GitHub App Webhook の新設**: `POST /webhook/github` を追加し、`installation` イベント（`created`, `deleted`, `permissions_accepted`, `suspend`, `unsuspend`）を受信すれば、権限変更をリアルタイムで検知・通知可能。ただし GitHub App 側の Webhook URL 設定が必要

---

## その他外部連携

| 関数/呼び出し | メソッド | エンドポイント | 呼び出し元 | 定義ファイル | 最終コミット |
|---|---|---|---|---|---|
| (直接fetch) | GET | `https://mynw.nekomaneki.work/lib/resend-webhook.shtml?event={type}` | `/webhook/resend` | `src/index.ts` L965 | `d2b2898` 2026-03-13 |

---

## ソースファイル一覧

### アプリケーション

| ファイル | 役割 | 最終コミット | 日時 |
|---|---|---|---|
| `src/index.ts` | ルートハンドラ・ビジネスロジック | `f66113d` | 2026-03-16 10:37 |
| `src/middleware/auth.ts` | JWT 認証ミドルウェア | `6187336` | 2026-03-13 03:22 |

### ビュー

| ファイル | 役割 | 最終コミット | 日時 |
|---|---|---|---|
| `src/views/login.ts` | ログインページ HTML | `ea91d8f` | 2026-03-07 14:37 |
| `src/views/welcome.ts` | ウェルカムページ HTML | `c3f20e1` | 2026-03-14 22:22 |
| `src/views/settings.ts` | 設定ページ HTML | `a0e5e49` | 2026-03-16 02:07 |
| `src/views/repositories.ts` | リポジトリ一覧ページ HTML | `1a8bf0c` | 2026-03-16 10:19 |

### ユーティリティ

| ファイル | 役割 | 最終コミット | 日時 |
|---|---|---|---|
| `src/utils/github.ts` | GitHub API ユーティリティ | `f66113d` | 2026-03-16 10:37 |
| `src/utils/jwt.ts` | JWT 生成・検証 | `e08a15b` | 2026-03-14 23:09 |
| `src/utils/cookie.ts` | Cookie パース | `ea91d8f` | 2026-03-07 14:37 |
| `src/utils/html.ts` | HTML エスケープ | `ea91d8f` | 2026-03-07 14:37 |
| `src/utils/logger.ts` | ロガー・Analytics | `ea91d8f` | 2026-03-07 14:37 |
| `src/utils/resendWebhook.ts` | Resend Webhook 署名検証 | `d2b8c0d` | 2026-03-12 19:32 |
| `src/utils/slack.ts` | Slack メッセージ送信 | `c155d7d` | 2026-03-13 02:15 |

---

## D1 データベーススキーマ

### `user_sessions` テーブル

| カラム | 型 | デフォルト | マイグレーション |
|---|---|---|---|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | - | 0001 |
| `user_id` | TEXT NOT NULL UNIQUE | - | 0001 |
| `timezone` | TEXT | `'UTC'` | 0001 |
| `session_duration` | TEXT | `'1h'` | 0001 |
| `last_login_at` | TEXT | NULL | 0001 |
| `current_login_at` | TEXT NOT NULL | - | 0001 |
| `updated_at` | TEXT NOT NULL | - | 0001 |
| `display_name` | TEXT | NULL | 0002 |
| `github_access_token` | TEXT | NULL | 0003 |

---

## 認証方式

| 表記 | ミドルウェア | 挙動 |
|---|---|---|
| **必須** | `authMiddleware` | JWT 未検証で 401 |
| **任意** | `optionalAuthMiddleware` | JWT があれば検証、なくても通過 |
| **不要** | なし | 認証チェックなし |
| **署名検証** | なし（ハンドラ内で検証） | Svix 署名ヘッダーで検証 |

---

## `/repositories` のデータフロー

```
ページ読み込み (GET /repositories)
  ├─ サーバーサイド
  │   ├─ getGitHubTokenScopes()          → OAuthスコープ取得
  │   ├─ buildRepoInstallationPermissionsMap()
  │   │   ├─ getGitHubUserInstallations() → GET /user/installations
  │   │   └─ getGitHubInstallationRepos() → GET /user/installations/{id}/repositories
  │   ├─ getGitHubUserRepos()            → リポジトリ一覧取得
  │   └─ getGitHubLatestCommit()         → 各リポジトリの最新コミット
  │
  └─ クライアントサイド（DOMContentLoaded後）
      └─ fetch('/api/repo-permissions')  → 最新インストール権限を取得
          └─ 差分があれば repoPermsData を更新
```
