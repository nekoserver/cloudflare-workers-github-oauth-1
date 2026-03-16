# cloudflare-workers-github-oauth

GitHub OAuth + JWT 認証の Cloudflare Workers 実装。

## 機能

- **GitHub OAuth 2.0** 認証フロー
- **JWT トークン** 発行・検証（HMAC-SHA256、Web Crypto API）
- **Cloudflare D1** を使用したセッション管理
- **認証ミドルウェア**（Bearer トークン / Cookie 対応）
- タイムゾーン設定・セッション有効期限設定
- 構造化ログ・Analytics Engine 対応

## エンドポイント

| エンドポイント | メソッド | 認証 | 説明 |
|---|---|---|---|
| `/` | GET | - | ログインページ |
| `/auth/github` | GET | - | GitHub OAuth 開始 |
| `/auth/github/callback` | GET | - | GitHub OAuth コールバック |
| `/welcome` | GET | 必要 | ウェルカムページ |
| `/settings` | GET | 必要 | 設定ページ |
| `/api` | GET | - | API 情報 |
| `/api/public` | GET | オプション | 公開エンドポイント |
| `/api/protected` | GET | 必要 | 保護リソース |
| `/api/profile` | GET | 必要 | プロフィール取得 |
| `/api/profile` | PUT | 必要 | プロフィール更新 |
| `/api/settings/timezone` | POST | 必要 | タイムゾーン変更 |
| `/api/settings/session-duration` | POST | 必要 | セッション有効期限変更 |

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

---

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. GitHub OAuth App の作成

[GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/applications/new) で OAuth App を作成し、以下を設定：

- **Authorization callback URL**: `https://<your-worker>.workers.dev/auth/github/callback`

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

## 認証フロー

```
1. ユーザーが / にアクセス
2. GitHubログインボタンをクリック → /auth/github へリダイレクト
3. GitHub の認可ページへリダイレクト
4. ユーザーが認可 → /auth/github/callback にコードが届く
5. コードをアクセストークンに交換
6. GitHub API でユーザー情報を取得
7. JWT トークン生成 → Cookie に保存
8. /welcome にリダイレクト
```

### 重要: GitHub App Install フローのコールバック

GitHub App の **「Install App」** フローでは、コールバックが `/github/callback?setup_action=install` として戻る。
これは通常の OAuth 認証フロー（state/PKCE パラメータ付き）とは**異なるワークフロー**であり、コールバックハンドラで分岐処理が必要。

- `setup_action=install` が付いている場合、state パラメータは存在しないため state 検証をスキップする
- Install App フローはリポジトリアクセス権の付与が目的であり、認証トークンの発行フローではない
- 詳細は [NOTICE.cloudflare-workers-github-oauth-1.20260316.md](NOTICE.cloudflare-workers-github-oauth-1.20260316.md) を参照

## 環境変数

| 変数名 | 必須 | 説明 |
|---|---|---|
| `JWT_SECRET` | 必須 | JWT 署名用シークレットキー |
| `GITHUB_CLIENT_ID` | 必須 | GitHub OAuth App のクライアント ID |
| `GITHUB_CLIENT_SECRET` | 必須 | GitHub OAuth App のクライアントシークレット |
| `ENVIRONMENT` | - | 実行環境（development / production） |
