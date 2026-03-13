# SPEC: cloudflare-workers-github-oauth

> GitHub OAuth 2.0 + JWT認証を提供するCloudflare Workers アプリケーション

---

## 技術スタック

| 項目 | 技術 |
|---|---|
| ランタイム | Cloudflare Workers |
| フレームワーク | Hono v4 |
| 言語 | TypeScript 5.3+ |
| データベース | Cloudflare D1 (SQLite、オプション) |
| 認証 | GitHub OAuth 2.0 + JWT (HS256) |
| 暗号化 | Web Crypto API (HMAC-SHA256) |
| メトリクス | Cloudflare Analytics Engine (オプション) |
| CI/CD | Cloudflare Workers Builds (Git連携による自動デプロイ) |
| パッケージ管理 | npm |

## ディレクトリ構成

```
cloudflare-workers-github-oauth/
├── src/
│   ├── index.ts                  # エントリポイント、ルーティング、ビジネスロジック
│   ├── middleware/
│   │   └── auth.ts               # JWT認証ミドルウェア (必須/オプショナル)
│   ├── utils/
│   │   ├── jwt.ts                # JWT生成・検証 (Web Crypto API)
│   │   ├── github.ts             # GitHub API クライアント
│   │   ├── cookie.ts             # Cookie解析ユーティリティ
│   │   ├── html.ts               # HTMLエスケープ (XSS対策)
│   │   ├── logger.ts             # 構造化ログ・Analytics Engine記録
│   │   ├── resendWebhook.ts      # Resend webhook署名検証 (Svix)
│   │   └── slack.ts              # Slack通知 (chat.postMessage)
│   └── views/
│       ├── login.ts              # ログインページHTML
│       ├── welcome.ts            # ウェルカムページHTML
│       ├── settings.ts           # 設定ページHTML
│       └── session-expired.ts    # セッション期限切れトーストHTML
├── migrations/
│   ├── 0001_create_user_sessions.sql  # user_sessions テーブル作成
│   └── 0002_add_display_name.sql      # display_name カラム追加
├── wrangler.toml                 # Cloudflare Workers 設定
├── tsconfig.json
├── package.json
├── .dev.vars.example             # ローカル開発用環境変数テンプレート
├── .gitignore
└── README.md
```

---

## 認証フロー

```
1. ユーザーが / にアクセス → ログインページを表示
2. 「GitHubアカウントでログイン」ボタンをクリック
3. GET /auth/github → CSRF用stateを生成しCookieに保存 → GitHub認可ページへ302リダイレクト
4. ユーザーがGitHubで認可
5. GET /auth/github/callback にcodeとstateが届く
6. stateパラメータをCookieのoauth_stateと照合 (CSRF検証)
7. codeをGitHubアクセストークンに交換 (POST github.com/login/oauth/access_token)
8. アクセストークンでGitHub APIからユーザー情報・メール取得
9. D1からユーザー設定を読み込み (既存ユーザー) / 新規作成
10. JWT生成 → auth_tokenとしてHttpOnly Cookieに保存
11. /welcome に302リダイレクト
```

---

## エンドポイント一覧

### ページ (HTML)

| パス | メソッド | 認証 | 説明 |
|---|---|---|---|
| `/` | GET | - | ログインページ |
| `/auth/github` | GET | - | GitHub OAuth開始 (GitHubへリダイレクト) |
| `/auth/github/callback` | GET | - | OAuthコールバック → JWT発行 → /welcomeへリダイレクト |
| `/auth/logout` | GET | - | ログアウト (Cookie削除 → /へリダイレクト) |
| `/welcome` | GET | 必須 | ウェルカムページ (ユーザー情報・前回ログイン日時表示) |
| `/settings` | GET | 必須 | 設定ページ (タイムゾーン・セッション期限・トークン情報) |
| `/health` | GET | - | ヘルスチェック (JSON) |

### API (JSON)

| パス | メソッド | 認証 | 説明 |
|---|---|---|---|
| `/api` | GET | - | API情報 (エンドポイント一覧) |
| `/api/public` | GET | オプション | 公開エンドポイント (認証済みなら追加情報) |
| `/api/protected` | GET | 必須 | 保護リソースアクセス |
| `/api/profile` | GET | 必須 | ユーザープロフィール取得 |
| `/api/profile` | PUT | 必須 | 表示名更新 (D1に保存) |
| `/api/settings/timezone` | POST | 必須 | タイムゾーン変更 (UTC/JST) |
| `/api/settings/session-duration` | POST | 必須 | セッション有効期限変更 |
| `/webhook/resend` | POST | - | Resend webhook受信 (署名検証 + オリジン通知 + Slack通知) |

---

## Webhook: Resend

### 受信

- エンドポイント: `POST /webhook/resend`
- 署名検証: `svix-id`, `svix-timestamp`, `svix-signature` を利用して `RESEND_WEBHOOK_SECRET` で検証
- 無効な署名は `401`、JSON不正は `400` を返す

### オリジン通知

- 受信イベントの `type` を `event` クエリに乗せてオリジンへGET通知
- 通知先: `https://mynw.nekomaneki.work/lib/resend-webhook.shtml?event=<type>`
- 失敗時は `502` を返す

### Slack通知

- Slack通知は「送信結果が確定するイベントのみ」送信する
- `email.delivered` は `送信完了` として通知する
- `email.failed` と `email.bounced` は `失敗` として通知する
- `email.sent` など送信前イベントでは通知しない
- 投稿内容は以下の4行構成
- `Resend: <送信完了|失敗>`
- `from: <from>`
- `to: <to>`
- `件名: <subject>`

---

## 認証・セキュリティ

### JWT

- アルゴリズム: HS256 (HMAC-SHA256)
- 署名・検証: Web Crypto API (`crypto.subtle`)
- ペイロード: `sub` (ユーザー名), `name`, `email`, `github_id`, `iat`, `exp`
- デフォルト有効期限: 1時間 (ユーザー設定で変更可能)
- 外部ライブラリ不使用の独自実装 (`src/utils/jwt.ts`)

### トークン取得の優先順位 (authミドルウェア)

1. `Authorization: Bearer <token>` ヘッダー
2. `auth_token` Cookie (HttpOnly)

### CSRF対策

- OAuth開始時に32バイトのランダムstateトークンを生成
- HttpOnly Cookie (`oauth_state`) に保存、5分間有効
- コールバック時にクエリパラメータのstateとCookieのstateを照合

### Cookie一覧

| Cookie名 | HttpOnly | 用途 |
|---|---|---|
| `auth_token` | Yes | JWTトークン |
| `oauth_state` | Yes | CSRF検証用stateトークン (5分) |
| `show_welcome_message` | Yes | 初回ログイン直後のウェルカムメッセージ表示 (60秒) |
| `login_timestamp` | No | ログイン日時 (クライアント参照用) |
| `user_timezone` | No | タイムゾーン設定 (1年) |
| `user_session_duration` | No | セッション有効期限設定 (1年) |

### XSS対策

- ユーザー入力のHTML出力時に `escapeHtml()` でエスケープ (`src/utils/html.ts`)
- `&`, `<`, `>`, `"`, `'` をHTMLエンティティに変換

### GitHub OAuthスコープ

- `read:user`: ユーザープロフィールの読み取り
- `user:email`: メールアドレスの読み取り (プライベートメール含む)

---

## データベース (D1)

### user_sessions テーブル

| カラム | 型 | 説明 |
|---|---|---|
| `id` | INTEGER (PK, AUTO) | 主キー |
| `user_id` | TEXT (UNIQUE, NOT NULL) | GitHubユーザー名 |
| `timezone` | TEXT (DEFAULT 'UTC') | タイムゾーン設定 |
| `session_duration` | TEXT (DEFAULT '1h') | セッション有効期限設定 |
| `display_name` | TEXT | 表示名 |
| `last_login_at` | TEXT | 前回ログイン日時 (ISO 8601) |
| `current_login_at` | TEXT (NOT NULL) | 今回ログイン日時 (ISO 8601) |
| `updated_at` | TEXT (NOT NULL) | 最終更新日時 (ISO 8601) |

- インデックス: `idx_user_id` on `user_id`
- D1は**オプション**: 未設定でもアプリは動作するが、ログイン履歴・設定は保存されない

### マイグレーション

- `0001_create_user_sessions.sql`: テーブル作成 + インデックス
- `0002_add_display_name.sql`: `display_name` カラム追加

---

## CI/CD

### Cloudflare Workers Builds (Git連携)

- Cloudflareダッシュボードからリポジトリを接続して自動デプロイ
- 設定手順:
  1. Cloudflareダッシュボード → Workers & Pages → 対象Worker → Settings → Builds
  2. 「Connect」からGitHubリポジトリを接続
  3. Production branch: `main`、デプロイコマンド: `npx wrangler deploy`
- pushごとにCloudflare側でビルド・デプロイが実行される
- GitHub Actionsの無料枠制限を受けない

---

## セッション有効期限

| 値 | 秒数 | 表示 |
|---|---|---|
| `1h` | 3600 | 1時間 (デフォルト) |
| `3h` | 10800 | 3時間 |
| `8h` | 28800 | 8時間 |
| `1d` | 86400 | 1日 |
| `3d` | 259200 | 3日 |
| `1w` | 604800 | 1週間 |

---

## 環境変数・バインディング

### シークレット (`wrangler secret put`)

| 変数名 | 必須 | 説明 |
|---|---|---|
| `JWT_SECRET` | 必須 | JWT署名用シークレットキー |
| `GITHUB_CLIENT_ID` | 必須 | GitHub OAuth App クライアントID |
| `GITHUB_CLIENT_SECRET` | 必須 | GitHub OAuth App クライアントシークレット |
| `RESEND_WEBHOOK_SECRET` | 必須 | Resend webhook署名検証用シークレット |
| `SLACK_SIGNING_SECRET` | 必須 | Slack App署名検証用シークレット |
| `SLACK_OAUTH_TOKEN` | 必須 | Slack Bot OAuth Token |
| `SLACK_CLIENT_SECRET` | 必須 | Slack App Client Secret |
| `SLACK_CLIENT_ID` | 必須 | Slack App Client ID |
| `SLACK_CHANNEL_ID` | 必須 | Slack通知先チャンネルID |

### 環境変数 (`wrangler.toml` [vars])

| 変数名 | デフォルト | 説明 |
|---|---|---|
| `ENVIRONMENT` | `"development"` | 実行環境識別 |
| `GITHUB_CLIENT_ID` | 設定済み | 開発用クライアントID |

### オプションバインディング

| バインディング | 型 | 説明 |
|---|---|---|
| `DB` | D1Database | ユーザーセッション管理 |
| `ANALYTICS` | AnalyticsEngineDataset | メトリクス記録 (`github_oauth_metrics`) |

---

## 構造化ログ・オブザーバビリティ

- `src/utils/logger.ts` でJSON形式の構造化ログを出力
- ログレベル: `DEBUG`, `INFO`, `WARN`, `ERROR`
- `wrangler.toml` で `[observability] enabled = true` を設定
- Analytics Engine: 認証成功/失敗、未処理エラーをメトリクスとして記録

---

## UIページ

### ログインページ (`/`)

- GitHubアカウントでログインボタン (→ `/auth/github` へリンク)
- API情報セクション (開発者向けエンドポイント一覧)

### ウェルカムページ (`/welcome`)

- ナビバー: ユーザーアイコン + ドロップダウン (設定 / ログアウト)
- ログイン直後は「ようこそ」メッセージ表示 (`show_welcome_message` Cookie判定)
- ユーザー情報: ユーザー名、メール、前回ログイン日時
- 利用可能なAPIエンドポイント一覧

### 設定ページ (`/settings`)

- アカウント情報 (ユーザー名、名前、メール)
- ログイン状況 (ログイン日時、有効期限、残り時間のリアルタイムカウントダウン)
- セッション有効期限設定 (チェックボックスで編集有効化 → 保存/キャンセル)
- タイムゾーン設定 (UTC/JST、チェックボックスで編集有効化 → 保存/キャンセル)
- 期限切れ時に自動的にトップページへリダイレクト

### セッション期限切れトースト

- 画面左上にピンク色のトースト通知を表示
- 「了解」ボタンまたは10秒後に自動でログインページへリダイレクト

---

## 既知の設計判断・制約

- **レートリミット**: アプリ内には実装せず、Cloudflare WAFのRate Limiting Rulesで対応する方針 (コメントで明示)
- **タイムゾーン**: UTC/JSTの2択。手動オフセット計算 (+9h) でIntl API不使用
- **JWTライブラリ不使用**: Web Crypto APIを直接使用した独自実装
- **SSR**: Honoのテンプレートリテラルで全ページをサーバーサイドレンダリング (SPAフレームワーク不使用)
- **D1オプション化**: D1未設定でもコア機能 (OAuth + JWT認証) は動作する
- **Cookie Secure属性**: 全Cookieに `Secure; SameSite=Lax` を付与
- **プロフィール更新**: `PUT /api/profile` は表示名をD1に保存するが、JWTの再発行はしない (次回ログイン時に反映)
- **CORSミドルウェア**: 全パスに `cors()` を適用
- **エラーレスポンス**: ブラウザリクエスト (Accept: text/html) にはHTML、APIリクエストにはJSONを返す
