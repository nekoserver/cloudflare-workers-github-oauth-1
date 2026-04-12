# cloudflare-workers-github-oauth

GitHub OAuth + JWT 認証の Cloudflare Workers 実装。

## 機能

- **GitHub OAuth 2.0** 認証フロー（PKCE S256 + state パラメータによる CSRF 防止）
- **JWT トークン** 発行・検証（HMAC-SHA256、Web Crypto API）
- **Cloudflare D1** を使用したセッション管理
- **認証ミドルウェア**（Bearer トークン / Cookie 対応）
- **GitHub App Webhook** によるインストール権限の D1 リアルタイム同期
- **Resend Webhook** によるメール配信ステータス通知
- リポジトリ一覧ページ（権限モーダル・Zanzibar タプル/ツリー表示）
- スコープ不足時の再認証フロー
- タイムゾーン設定・セッション有効期限設定・アイドルタイムアウト
- タイムゾーン既定はJST（必要に応じてUTCへ変更可）
- セキュリティ通知（JWT 検証失敗・ログイン失敗・App 変更の Slack 通知）
- 構造化ログ・Analytics Engine 対応
- セキュリティヘッダー（CSP・HSTS・X-Frame-Options・Referrer-Policy・Permissions-Policy）

## エンドポイント

### ページ

| エンドポイント | メソッド | 認証 | 説明 |
|---|---|---|---|
| `/` | GET | - | ログインページ |
| `/welcome` | GET | 必要 | ウェルカムページ |
| `/settings` | GET | 必要 | 設定ページ |
| `/repositories` | GET | オプション | リポジトリ一覧（権限モーダル付き） |

### 認証

| エンドポイント | メソッド | 認証 | 説明 |
|---|---|---|---|
| `/auth/github` | GET | - | GitHub OAuth 開始（PKCE + state 生成） |
| `/github/callback` | GET | - | GitHub OAuth コールバック |
| `/auth/github/reauthorize` | GET | 必要 | スコープ不足時の再認証 |
| `/auth/logout` | GET | - | ログアウト（Cookie 削除） |

### API

| エンドポイント | メソッド | 認証 | 説明 |
|---|---|---|---|
| `/health` | GET | - | ヘルスチェック |
| `/api` | GET | - | API 情報 |
| `/api/public` | GET | オプション | 公開エンドポイント |
| `/api/protected` | GET | 必要 | 保護リソース |
| `/api/profile` | GET | 必要 | プロフィール取得 |
| `/api/profile` | PUT | 必要 | プロフィール更新（表示名） |
| `/api/settings/timezone` | POST | 必要 | タイムゾーン変更 |
| `/api/settings/session-duration` | POST | 必要 | セッション有効期限変更 |
| `/api/repo-permissions` | GET | 必要 | インストール権限取得（D1 優先・API フォールバック） |

### Webhook

| エンドポイント | メソッド | 認証 | 説明 |
|---|---|---|---|
| `/webhook/github` | POST | HMAC-SHA256 署名 | GitHub App Webhook 受信（installation イベント） |
| `/webhook/resend` | POST | Svix 署名 | Resend Webhook 受信（メール配信ステータス） |

#### AI要約リンク運用メモ（Slack の `/ai-summary/{request_id}`）

- Slack に出る「HTMLで表示」リンクは、このワーカーの D1 (`ai_summary_log`) に保存された `request_id` を参照します。
- そのため、**対象リポジトリのWebhook送信先がこのワーカーを向いていない**場合、リンクを開いても要約を見つけられません（404）。
- `/ai-summary/:id` と `/view?id=...` は、補助処理（`view_count` 更新・`ai_summary_reviews` 読み込み）に失敗してもページ描画を継続し、ログに警告を残します。運用時はワーカーログで `AI summary row not found` や `Failed to load ai_summary_reviews` を確認してください。
- さらに D1 の `ai_summary_link_access_log` にリンクアクセス時の診断情報（`request_id`, `found`, `issue_code`, `referer`, `user_agent`）を保存します。Webhook 向き先不一致の切り分けに利用できます。

### 診断

| エンドポイント | メソッド | 認証 | 説明 |
|---|---|---|---|
| `/api/debug/d1` | GET | 必要 | D1 接続診断 |
| `/api/debug/installations` | GET | 必要 | GitHub App インストール権限の診断 |

## Cloudflare ダッシュボードからのデプロイ（Git 連携）

Cloudflare Workers の Git 連携（Workers Builds）でデプロイする場合、**デプロイコマンドの指定が必要**です。

| 設定項目 | 値 |
|---|---|
| ビルドコマンド | `npm install` |
| デプロイコマンド | `npm run deploy` |

> **重要**: デプロイコマンドを指定しないと、Cloudflare がデプロイ方法を判断できずエラーになります。

また、Cloudflare ダッシュボードで以下の **シークレット（環境変数）** の設定が必要です：
- `JWT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

D1 データベースを使用する場合は、先に下記「[3. D1 データベースの作成](#3-d1-データベースの作成)」を参照してください。
デプロイ後に D1 を追加することも可能です。

### ビルドタイミング運用の推奨（main マージ時の競合回避）

Git 連携では、`main` へのマージ直後に複数のビルドが同時進行し、**古いコミットのビルドが後から完了して意図しない反映になる**ことがあります。以下の設定で競合を減らせます。

1. **本番デプロイは `main` push のみに限定**（PR ブランチは Preview 扱い）
2. **同一ブランチの並列ビルドを抑止**（GitHub Actions なら `concurrency` + `cancel-in-progress: true`）
3. **Cloudflare 側の Production Branch を `main` に固定**し、手動デプロイ導線を一本化
4. **マージキュー（または直列マージ運用）**で `main` への流入を一列化

加えて、**Codex が作業開始時に自動で専用ブランチを切らない運用**だと、`main`（または共有ブランチ）へ直接コミットが混ざり、ビルド競合を増幅しやすくなります。次を推奨します。

- Codex 実行前に `feat/<topic>` などの作業ブランチを明示的に作成する
- ブランチ保護で `main` への直接 push を禁止し、PR 経由のみ許可する
- PR マージ完了まで次タスクの push を抑止する（1タスク1ブランチ）

#### Codex 運用時の最小フロー（main 直接競合を避ける）

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feat/<task-name>
# Codex で変更
# テスト後に push して PR 作成
git push -u origin feat/<task-name>
```

さらに GitHub 側で以下を有効化してください。

- `main` への直接 push を禁止（Branch protection rule）
- 必須ステータスチェック通過後のみマージ
- 「Require branches to be up to date before merging」を有効化

ローカルでも事故を防ぐため、同梱の pre-push フックを有効化できます。

```bash
git config core.hooksPath .githooks
```

この設定後は `main` / `master` への直接 push が拒否され、PR 運用を強制できます。
（緊急時のみ `ALLOW_MAIN_PUSH=1 git push ...` で一時的に回避）

「マージの瞬間」と「既存ビルドの完了」が重なる構成は、実際に不整合の原因になり得るため、タイミング調整とブランチ運用の固定化は推奨です。

---

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. GitHub OAuth App の作成

[GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/applications/new) で OAuth App を作成し、以下を設定：

- **Authorization callback URL**: `https://<your-worker>.workers.dev/github/callback`

> **注意**: コールバック URL パスは `/github/callback` です。`/auth/github/callback` ではありません。

### 3. D1 データベースの作成

D1 はセッション管理に使用します。D1 なしでもデプロイ・動作しますが、ログイン履歴やタイムゾーン設定は保存されません。

```bash
wrangler d1 create workers-github-oauth
```

出力された `database_id` を `wrangler.toml` の D1 設定部分に設定し、コメントを外してください：

```toml
[[d1_databases]]
binding = "DB"
database_name = "workers-github-oauth"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← ここを置き換え
```

### 4. マイグレーションの実行

```bash
# ローカル開発用
npm run db:migrate:local

# 本番環境
npm run db:migrate:remote
```

### 5. シークレットの設定

```bash
wrangler secret put JWT_SECRET
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
```

> **重要**: `GITHUB_CLIENT_ID` は `wrangler.toml` の `[vars]` に平文で書かず、必ず `wrangler secret` で管理してください。`[vars]` に書くと secret と競合して意図しない値が使われます。

オプションのシークレット：

```bash
# GitHub App Webhook 署名検証用
wrangler secret put GITHUB_WEBHOOK_SECRET

# Slack 通知用
wrangler secret put SLACK_OAUTH_TOKEN
wrangler secret put SLACK_CHANNEL_ID

# Resend Webhook 署名検証用
wrangler secret put RESEND_WEBHOOK_SECRET
```

### 6. ローカル開発

`.dev.vars.example` をコピーして `.dev.vars` を作成し、値を設定：

```bash
cp .dev.vars.example .dev.vars
```

```bash
npm run dev
```

### 7. デプロイ

```bash
npm run deploy
```

## npm スクリプト

| スクリプト | 説明 |
|---|---|
| `npm run dev` | ローカル開発サーバー起動 |
| `npm run deploy` | Cloudflare Workers へデプロイ |
| `npm run typecheck` | TypeScript 型チェック（`tsc --noEmit`） |
| `npm run db:migrate:local` | D1 ローカルマイグレーション |
| `npm run db:migrate:remote` | D1 リモートマイグレーション |

## 認証フロー

```
1. ユーザーが / にアクセス
2. GitHubログインボタンをクリック → /auth/github へリダイレクト
3. state + PKCE (S256) を生成し Cookie に保存
4. GitHub の認可ページへリダイレクト
5. ユーザーが認可 → /github/callback にコードが届く
6. state パラメータと PKCE verifier を検証（CSRF 防止）
7. コードをアクセストークンに交換
8. GitHub API でユーザー情報を取得
9. JWT トークン生成 → HttpOnly Cookie に保存
10. /welcome にリダイレクト
```

### 重要: GitHub App Install フローのコールバック

GitHub App の **「Install App」** フローでは、コールバックが `/github/callback?setup_action=install` として戻る。
これは通常の OAuth 認証フロー（state/PKCE パラメータ付き）とは**異なるワークフロー**であり、コールバックハンドラで分岐処理が必要。

- `setup_action=install` が付いている場合、state パラメータは存在しないため state 検証をスキップする
- Install App フローはリポジトリアクセス権の付与が目的であり、認証トークンの発行フローではない
- 詳細は [NOTICE.cloudflare-workers-github-oauth-1.20260316.md](NOTICE.cloudflare-workers-github-oauth-1.20260316.md) を参照

## セキュリティ

| 対策 | 実装 |
|---|---|
| CSRF 防止 | OAuth state パラメータ（Cookie 保存 + コールバックで比較） |
| PKCE | S256 チャレンジ/レスポンス |
| Cookie 保護 | 全 Cookie に `HttpOnly; Secure; SameSite=Lax` |
| Webhook 署名検証 | HMAC-SHA256 タイミングセーフ比較 |
| SQL インジェクション防止 | D1 プリペアドステートメント（`db.prepare().bind()`） |
| XSS 防止 | サーバーサイド `escapeHtml()` + クライアントサイド `esc()` |
| セキュリティヘッダー | CSP・X-Frame-Options・HSTS・Referrer-Policy・Permissions-Policy |
| 秘密情報管理 | `wrangler secret`（`[vars]` に平文なし） |
| 不審アクセス通知 | JWT 検証失敗・ログイン失敗・App 変更を Slack 通知 |

## 環境変数

| 変数名 | 必須 | 説明 |
|---|---|---|
| `JWT_SECRET` | 必須 | JWT 署名用シークレットキー |
| `GITHUB_CLIENT_ID` | 必須 | GitHub OAuth App のクライアント ID |
| `GITHUB_CLIENT_SECRET` | 必須 | GitHub OAuth App のクライアントシークレット |
| `ENVIRONMENT` | - | 実行環境（development / production） |
| `GITHUB_WEBHOOK_SECRET` | - | GitHub App Webhook 署名検証用シークレット |
| `SLACK_OAUTH_TOKEN` | - | Slack Bot トークン（通知用） |
| `SLACK_CHANNEL_ID` | - | Slack 通知先チャンネル ID |
| `SLACK_SIGNING_SECRET` | - | Slack 署名検証用シークレット |
| `SLACK_CLIENT_ID` | - | Slack App クライアント ID |
| `SLACK_CLIENT_SECRET` | - | Slack App クライアントシークレット |
| `RESEND_WEBHOOK_SECRET` | - | Resend Webhook 署名検証用シークレット |
| `RESEND_WEBHOOK_DEDUP_TTL_SECONDS` | - | Resend Webhook 重複排除 TTL（デフォルト: 600秒） |
| `SESSION_IDLE_TIMEOUT_SECONDS` | - | アイドルタイムアウト秒数（デフォルト: 1800秒） |

## ドキュメント

| ファイル | 説明 |
|---|---|
| [API リファレンス](API.cloudflare-workers-github-oauth-1.latest.md) | 全エンドポイント・外部 API・ファイル一覧 |
| [SPEC（仕様）](SPEC.cloudflare-workers-github-oauth-1.latest.md) | セッション中の修正・追加の仕様まとめ |
| [NOTICE（知見）](NOTICE.cloudflare-workers-github-oauth-1.20260316.md) | 知らないと損する仕様・落とし穴 |
| [HISTORY（履歴）](HISTORY.cloudflare-workers-github-oauth-1.latest.md) | コミット履歴 |
| [ZANZIBAR（権限モデル）](ZANZIBAR.cloudflare-workers-github-oauth-1.md) | GitHub App 権限の Zanzibar 形式定義 |
| [EVAL（実装評価）](EVAL.cloudflare-workers-github-oauth-1.20260316.md) | コード品質・セキュリティ評価 |
