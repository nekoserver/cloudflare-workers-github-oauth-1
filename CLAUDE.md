# CLAUDE.md

## ワークフロー: cloudflare-workers-github-oauth プロビジョニング

本リポジトリはワークフロー **「cloudflare-workers-github-oauth プロビジョニング」** により
テンプレートから生成された連番インスタンスである。

### ワークフロー定義

| 項目 | 値 |
|---|---|
| ワークフロー名 | cloudflare-workers-github-oauth プロビジョニング |
| テンプレートリポジトリ | `cloudflare-workers-github-oauth` |
| インスタンス命名規則 | `cloudflare-workers-github-oauth-{N}` |
| 手順書 | `CLONE_JOBS.cloudflare-workers-github-oauth.md` |

### 本インスタンスの情報

| 項目 | 値 |
|---|---|
| インスタンス番号 | 1 |
| リポジトリ名 | `cloudflare-workers-github-oauth-1` |
| Worker名 | `cloudflare-workers-github-oauth-1` |
| コールバックURLパス | `/github/callback` |
| フレームワーク | Hono + Cloudflare Workers |
| 認証方式 | GitHub OAuth + JWT |

---

## Claude Code 環境の制約事項

### GitHub API アクセス不可
- GitHub APIトークンが存在しない
- gitプロキシ（127.0.0.1:39093）は **gitプロトコルのみ** 対応。REST APIは通らない
- `gh` CLIはインストール可能だが認証トークンがないためAPI操作不可
- **PRはブラウザから手動作成する**。push後にcompareリンクを提示:
  `https://github.com/{OWNER}/{REPO}/compare/{base}...{head}`

### Cloudflare Workers デプロイ不可
- `CLOUDFLARE_API_TOKEN` が存在しないため `wrangler deploy` は実行不可
- Cloudflare MCP は参照のみ（一覧・詳細・コード取得）。デプロイ機能なし
- **デプロイはユーザーのローカル環境から行う**

### 利用可能なMCPツール
- **Cloudflare Developer Platform**: Workers/KV/D1/R2 の参照操作のみ
- **Slack**: メッセージ送信・チャンネル検索等
- **Vercel**: デプロイ・プロジェクト管理
- **Context7**: ライブラリドキュメント検索

### パッケージインストール
- `apt-get` は外部リポジトリへのアクセスが制限されている
- システムにプリインストール済みのパッケージのみ利用可能な場合がある

---

## 過去のトラブルと教訓

### wrangler.toml の name 不一致 → redirect_uri mismatch
- テンプレートからクローン後 `wrangler.toml` の `name` を更新し忘れると
  デプロイ先が別の Worker になり、GitHub OAuth App のコールバックURLと不一致になる
- **クローン直後に `wrangler.toml` の `name` を必ず確認・修正すること**

### コールバックURLパスの不一致
- GitHub OAuth App 側の callback URL パスとソースコード側のパスは必ず統一する
- 本テンプレートでは `/github/callback` を使用する
- よくある間違い: GitHub側が `/auth/github/callback`、コード側が `/github/callback`

### GITHUB_CLIENT_ID を wrangler.toml [vars] に平文で書いてはいけない
- `GITHUB_CLIENT_ID` は `wrangler secret put` で暗号化管理する
- `wrangler.toml` の `[vars]` に平文で書くと、secret と競合して意図しない値が使われる
- **`[vars]` には GITHUB_CLIENT_ID を絶対に書かない。secret に一元化すること**
- `.dev.vars.example` にも実際の値を書かない（プレースホルダーのみ）
