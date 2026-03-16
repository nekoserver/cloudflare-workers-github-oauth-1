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
| POST | `/webhook/resend` | 署名検証 | Resend Webhook 受信 | `d2b2898` 2026-03-13 |

### デバッグ用

| メソッド | パス | 認証 | 説明 | 用途 | 最終コミット |
|---|---|---|---|---|---|
| GET | `/api/debug/d1` | 必須 | D1 接続診断 | テーブル存在・カラム・レコード確認・テスト書き込み | `c98a14d` 2026-03-16 |
| GET | `/api/debug/installations` | 必須 | GitHub App インストール診断 | API生レスポンス・権限マップ・リポジトリ紐付け確認 | `f66113d` 2026-03-16 |

---

## 外部API呼び出し一覧

### GitHub API（`api.github.com`）

| 関数名 | メソッド | エンドポイント | 認証方式 | 呼び出し元 | 定義ファイル |
|---|---|---|---|---|---|
| `getGitHubUser` | GET | `/user` | Bearer token | `/github/callback` | `src/utils/github.ts` |
| `getGitHubUserEmail` | GET | `/user/emails` | Bearer token | `/github/callback` | `src/utils/github.ts` |
| `getGitHubUserRepos` | GET | `/user/repos` または `/users/{name}/repos` | Bearer token（任意） | `/repositories` | `src/utils/github.ts` |
| `getGitHubLatestCommit` | GET | `/repos/{owner}/{repo}/commits?per_page=1` | Bearer token（任意） | `/repositories` | `src/utils/github.ts` |
| `getGitHubTokenScopes` | POST | `/applications/{clientId}/token` | Basic (clientId:clientSecret) | `/settings`, `/repositories` | `src/utils/github.ts` |
| `getGitHubUserInstallationsWithDiag` | GET | `/user/installations` | Bearer token | `/repositories`, `/api/repo-permissions`, `/api/debug/installations` | `src/utils/github.ts` |
| `getGitHubInstallationRepos` | GET | `/user/installations/{id}/repositories` | Bearer token | `/repositories`, `/api/repo-permissions`, `/api/debug/installations` | `src/utils/github.ts` |
| (直接fetch) | DELETE | `/applications/{clientId}/grant` | Basic (clientId:clientSecret) | `/auth/github/reauthorize` | `src/index.ts` L522 |

### GitHub OAuth（`github.com`）

| 関数名 | メソッド | エンドポイント | 呼び出し元 | 定義ファイル |
|---|---|---|---|---|
| `getGitHubAccessToken` | POST | `/login/oauth/access_token` | `/github/callback` | `src/utils/github.ts` |

### その他外部

| 関数名 | メソッド | エンドポイント | 呼び出し元 | 定義ファイル |
|---|---|---|---|---|
| `postSlackMessage` | POST | `https://slack.com/api/chat.postMessage` | `/webhook/resend` | `src/utils/slack.ts` |
| (直接fetch) | GET | `https://mynw.nekomaneki.work/lib/resend-webhook.shtml` | `/webhook/resend` | `src/index.ts` L965 |

---

## ソースファイル一覧

| ファイル | 役割 | 最終コミット | 日時 |
|---|---|---|---|
| `src/index.ts` | ルートハンドラ・ビジネスロジック | `f66113d` | 2026-03-16 10:37 |
| `src/utils/github.ts` | GitHub API ユーティリティ | `f66113d` | 2026-03-16 10:37 |
| `src/views/repositories.ts` | リポジトリ一覧ページ HTML | `1a8bf0c` | 2026-03-16 10:19 |
| `src/views/settings.ts` | 設定ページ HTML | `a0e5e49` | 2026-03-16 02:07 |
| `src/views/welcome.ts` | ウェルカムページ HTML | `c3f20e1` | 2026-03-14 22:22 |
| `src/views/login.ts` | ログインページ HTML | `ea91d8f` | 2026-03-07 14:37 |
| `src/middleware/auth.ts` | JWT 認証ミドルウェア | `6187336` | 2026-03-13 03:22 |
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
