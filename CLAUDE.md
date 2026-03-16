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

---

## HTML 手順書のスタイルルール（Monodoc 形式）

詳細は [`RULES.cloudflare-workers-github-oauth-N.md`](RULES.cloudflare-workers-github-oauth-N.md) を参照。
手順書 HTML を生成・編集する際は必ず RULES ファイルに従うこと。

要点:
- `--nav-width` は **`240px`** 固定（変更禁止）
- すべての `<h2>` は `<details class="phase-details">` で折りたたみ可能にする
- `[A-Z]-[0-9]` の小見出しは `.step-block` で囲んだ領域として表現する
- 外部依存なし（単一 HTML ファイルで完結）

---

## Claude Code への行動指針（このリポジトリ固有）

以下は過去のセッションで繰り返した失敗から導いたルールである。必ず守ること。

1. **できないことを何度も試すな** — ツールやAPIが使えないと判明したら即座にユーザーに伝え、代替手段を提示する。同じ方法のバリエーションを繰り返し試さない
2. **PRはブラウザで作成** — この環境からGitHub APIは使えない。compareリンクを提示して終わり
3. **デプロイはユーザーに委ねる** — `CLOUDFLARE_API_TOKEN` がないため `wrangler deploy` は不可能。コード修正とpushまでが責務
4. **秘密情報は `[vars]` に書かない** — `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`JWT_SECRET` はすべて `wrangler secret` で管理。`wrangler.toml` に平文で書き戻さない
5. **テンプレートからクローンしたら最初に確認する3項目**:
   - `wrangler.toml` の `name` がインスタンス名と一致しているか
   - `wrangler.toml` の `[vars]` に秘密情報が平文で入っていないか
   - コールバックURLパスがGitHub OAuth App側と一致しているか

---

## NOTICEファイル運用ルール

セッション中に発見した「知らないと損すること」「気がつきにくいこと」「忘れると損すること」は
NOTICEファイルに書き出して記録する。

### 命名規則

```
NOTICE.<リポジトリ名>.<YYYYMMDD>.md
```

例: `NOTICE.cloudflare-workers-github-oauth-1.20260316.md`

### 記載対象
- 知らないと損する仕様・挙動
- 気がつきにくい落とし穴やハマりポイント
- 忘れると損する設定・手順・前提条件
- セッション中に得た重要な知見

### 運用
- 日付はそのセッションの日付を使う
- 同じ日に複数の知見があれば1ファイルに追記する
- 過去のNOTICEファイルは削除せず蓄積していく
