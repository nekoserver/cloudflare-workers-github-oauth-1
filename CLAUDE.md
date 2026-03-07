# CLAUDE.md - セッション間で共有する作業メモ

## 環境の制約事項

### GitHub API アクセス不可
- この環境にはGitHub APIトークンが存在しない
- gitプロキシ（127.0.0.1:39093）は **gitプロトコルのみ** 対応しており、REST API（`/api/v3/...`等）は通らない
- `gh` CLIはインストール可能だが、認証（`gh auth login`）に必要なトークンがないためAPI操作は不可
- **PRの作成はブラウザから手動で行う必要がある**。ブランチをpush後、compareリンクをユーザーに提示すること:
  `https://github.com/{OWNER}/{REPO}/compare/{base}...{head}`

### 利用可能なMCPツール
- **Cloudflare Developer Platform**: Workers/KV/D1/R2の操作
- **Slack**: メッセージ送信・チャンネル検索等
- **Vercel**: デプロイ・プロジェクト管理
- **Context7**: ライブラリドキュメント検索

GitHub操作用のMCPは提供されていない。

### パッケージインストール
- `apt-get`は外部リポジトリ（launchpad, cli.github.com等）へのアクセスが制限されている
- システムにプリインストール済みのパッケージのみ利用可能な場合がある

## プロジェクト構成

- テンプレート: `cloudflare-workers-github-oauth`
- 連番付きインスタンス: `cloudflare-workers-github-oauth-{N}`
- フレームワーク: Hono + Cloudflare Workers
- 認証: GitHub OAuth + JWT
- コールバックURLパス: `/github/callback`（GitHub OAuth App側と必ず一致させること）

## 作業手順書

新規インスタンスの構築手順は `CLONE_JOBS.cloudflare-workers-github-oauth.md` を参照。
