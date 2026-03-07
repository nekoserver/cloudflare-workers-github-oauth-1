# CLONE_JOBS: Cloudflare Workers GitHub OAuth 新規インスタンス構築手順

本文書は、テンプレートリポジトリ `cloudflare-workers-github-oauth` から
連番付きの新規プライベートリポジトリを作成し、GitHub OAuthアプリの認証情報を
埋め込み、Cloudflare Workersへデプロイするまでの全手順を文書化したものである。

---

## 前提条件

- GitHub アカウントにログイン済みであること
- Cloudflare アカウントにログイン済みであること
- `wrangler` CLI がインストール済みで `wrangler login` 済みであること
- `npm` が使用可能であること
- Claude Code（Web版またはCLI版）が使用可能であること

---

## フェーズ A: リポジトリの作成とクローン

### A-1. 連番の決定

テンプレート名: `cloudflare-workers-github-oauth`
命名規則: `cloudflare-workers-github-oauth-{N}` （N = 1, 2, 3, ...）

- GitHub上の自分のリポジトリ一覧を確認し、次の連番Nを決定する
- 例: `-1` が存在するなら次は `-2`

### A-2. GitHubでリポジトリを新規作成

1. GitHub にて `cloudflare-workers-github-oauth-{N}` という名前で **プライベート** リポジトリを作成する
2. README や .gitignore の自動生成は **しない**（テンプレートからコピーするため）

### A-3. テンプレートリポジトリのクローンとリモート付け替え

```bash
# テンプレートをクローン（別名ディレクトリとして）
git clone https://github.com/{OWNER}/cloudflare-workers-github-oauth.git \
  cloudflare-workers-github-oauth-{N}

cd cloudflare-workers-github-oauth-{N}

# リモートを新しいリポジトリに付け替え
git remote set-url origin https://github.com/{OWNER}/cloudflare-workers-github-oauth-{N}.git

# 初期プッシュ
git push -u origin main
```

**確認A-3**: `git remote -v` で origin が新しいリポジトリを指していること

---

## フェーズ B: GitHub OAuth App の作成

### B-1. GitHub OAuth App を新規登録

1. GitHub > Settings > Developer settings > OAuth Apps > "New OAuth App"
2. 以下の情報を入力する:

| 項目 | 値 |
|---|---|
| Application name | `cloudflare-workers-github-oauth-{N}` |
| Homepage URL | `https://cloudflare-workers-github-oauth-{N}.{CF_SUBDOMAIN}.workers.dev` |
| Authorization callback URL | `https://cloudflare-workers-github-oauth-{N}.{CF_SUBDOMAIN}.workers.dev/github/callback` |

> **重要**: `{CF_SUBDOMAIN}` は自分の Cloudflare Workers サブドメイン。
> Cloudflare Dashboard > Workers & Pages > Overview の右側に表示されている。

3. "Register application" をクリック

### B-2. Client ID と Client Secret を取得

1. 登録直後の画面で **Client ID** をコピーして控える
2. "Generate a new client secret" をクリックし **Client Secret** をコピーして控える

> **注意**: Client Secret はこの画面でしか表示されない。必ずこの時点で安全に記録する。

**確認B-2**:
- Client ID が `Ov23li` で始まる文字列であること
- Client Secret が 40文字の16進数文字列であること

---

## フェーズ C: プロジェクト設定の書き換え

### C-1. wrangler.toml の更新

`wrangler.toml` の `name` を新しいWorker名に変更する:

```toml
name = "cloudflare-workers-github-oauth-{N}"
```

**確認C-1**: `grep '^name' wrangler.toml` で正しい名前が表示されること

### C-2. wrangler.toml の GITHUB_CLIENT_ID を更新

`wrangler.toml` の `[vars]` セクション内の `GITHUB_CLIENT_ID` を
B-2 で取得した値に書き換える:

```toml
[vars]
ENVIRONMENT = "development"
GITHUB_CLIENT_ID = "{B-2で取得したClient ID}"
```

**確認C-2**: `grep 'GITHUB_CLIENT_ID' wrangler.toml` で正しい値が表示されること

### C-3. .dev.vars.example の更新（任意）

ローカル開発用に `.dev.vars.example` の `GITHUB_CLIENT_ID` も更新しておく。

### C-4. コールバックURLの確認

ソースコード内のコールバックURLパスが正しいことを確認する。
本テンプレートでは動的に生成されるため、通常は変更不要:

```typescript
// src/index.ts 内（2箇所）
const redirectUri = `${url.protocol}//${url.host}/github/callback`;
```

**確認C-4**: GitHub OAuth App の callback URL パスとソースコードのパスが一致していること

| 場所 | 期待されるパス |
|---|---|
| GitHub OAuth App 設定画面 | `.../github/callback` |
| src/index.ts（/auth/github ルート内） | `/github/callback` |
| src/index.ts（/github/callback ルート内） | `/github/callback` |

> **よくあるミス**: GitHub OAuth App 側が `/auth/github/callback` になっていて、
> ソースコード側は `/github/callback` になっている（またはその逆）パターン。
> 必ず統一すること。

---

## フェーズ D: 依存関係のインストールとデプロイ

### D-1. npm install

```bash
npm install
```

**確認D-1**: `node_modules/` が作成され、エラーが出ていないこと

### D-2. Cloudflare Workers へのデプロイ

```bash
npm run deploy
```

これは内部的に `wrangler deploy` を実行する。

**確認D-2**:
- デプロイが成功し、Worker URL が表示されること
- 表示された URL が `https://cloudflare-workers-github-oauth-{N}.{CF_SUBDOMAIN}.workers.dev` であること

### D-3. デプロイ後の疎通確認

```bash
curl https://cloudflare-workers-github-oauth-{N}.{CF_SUBDOMAIN}.workers.dev/health
```

**確認D-3**: `{"status":"ok", ...}` が返ること

---

## フェーズ E: Cloudflare シークレットの設定

### E-1. GITHUB_CLIENT_ID の設定

```bash
npx wrangler secret put GITHUB_CLIENT_ID
```

プロンプトが表示されたら B-2 で取得した Client ID を入力する。

### E-2. GITHUB_CLIENT_SECRET の設定

```bash
npx wrangler secret put GITHUB_CLIENT_SECRET
```

プロンプトが表示されたら B-2 で取得した Client Secret を入力する。

### E-3. JWT_SECRET の設定

```bash
npx wrangler secret put JWT_SECRET
```

十分に長いランダム文字列を入力する。以下で生成可能:

```bash
openssl rand -hex 32
```

**確認E-3**: 3つの secret が正常に設定されたこと（各コマンドで "Success" が表示される）

### E-4. シークレット設定後の再デプロイ（必要に応じて）

シークレット設定後、反映のために再デプロイが必要な場合がある:

```bash
npm run deploy
```

---

## フェーズ F: Claude Code へのリポジトリ許可設定

### F-1. Claude Code にリポジトリを追加

Claude Code（Web版）の設定にて、新しいリポジトリ
`{OWNER}/cloudflare-workers-github-oauth-{N}` への以下の権限を許可する:

- リポジトリの参照（読み取り）
- リポジトリの編集（書き込み）
- コミットおよびプッシュ

### F-2. Cloudflare MCP の許可（必要に応じて）

Claude Code から Cloudflare Workers へのデプロイやシークレット操作を行う場合:

- Cloudflare Developer Platform MCP の接続を確認
- Workers のデプロイ権限が有効であること

**確認F-2**: Claude Code のセッション内で `wrangler deploy` や
`wrangler secret put` が実行可能であること

---

## フェーズ G: OAuth フローの動作確認

### G-1. ログインページの表示確認

ブラウザで以下にアクセス:

```
https://cloudflare-workers-github-oauth-{N}.{CF_SUBDOMAIN}.workers.dev/
```

**確認G-1**: ログインページが表示され、「GitHubでログイン」ボタンがあること

### G-2. OAuth 認証フローの実行

1. 「GitHubでログイン」ボタンをクリック
2. GitHub の認証画面が表示される
3. "Authorize" をクリック
4. コールバック URL にリダイレクトされる
5. Welcome ページが表示される

**確認G-2**:
- GitHub 認証画面でアプリ名が `cloudflare-workers-github-oauth-{N}` であること
- 認証後に `/welcome` ページにリダイレクトされること
- ユーザー名、メールアドレスが正しく表示されること

### G-3. エラー発生時の切り分け

| 症状 | 原因の可能性 | 対処 |
|---|---|---|
| "GitHub OAuth is not configured" | GITHUB_CLIENT_ID 未設定 | フェーズ E-1 を確認 |
| GitHub側で "redirect_uri mismatch" | Callback URL の不一致 | フェーズ B-1 と C-4 を照合 |
| "Authentication failed" | Client Secret の誤り | フェーズ E-2 を再実行 |
| "Invalid state parameter" | CSRF state の不一致 | ブラウザのCookieをクリアして再試行 |
| "JWT_SECRET is not configured" | JWT_SECRET 未設定 | フェーズ E-3 を確認 |

---

## フェーズ H: コミットとプッシュ

### H-1. 変更のコミット

```bash
git add -A
git commit -m "feat: initialize cloudflare-workers-github-oauth-{N}"
```

### H-2. プッシュ

```bash
git push -u origin main
```

**確認H-2**: GitHub 上のリポジトリに変更が反映されていること

---

## チェックリスト（全手順完了確認用）

| # | 項目 | 状態 |
|---|---|---|
| A-1 | 連番 N を決定した | [ ] |
| A-2 | GitHub にプライベートリポジトリを作成した | [ ] |
| A-3 | テンプレートをクローンしリモートを付け替えた | [ ] |
| B-1 | GitHub OAuth App を登録した | [ ] |
| B-2 | Client ID と Client Secret を取得した | [ ] |
| C-1 | wrangler.toml の name を更新した | [ ] |
| C-2 | wrangler.toml の GITHUB_CLIENT_ID を更新した | [ ] |
| C-4 | コールバック URL の整合性を確認した | [ ] |
| D-1 | npm install を実行した | [ ] |
| D-2 | Cloudflare Workers へデプロイした | [ ] |
| D-3 | /health エンドポイントの疎通を確認した | [ ] |
| E-1 | wrangler secret: GITHUB_CLIENT_ID を設定した | [ ] |
| E-2 | wrangler secret: GITHUB_CLIENT_SECRET を設定した | [ ] |
| E-3 | wrangler secret: JWT_SECRET を設定した | [ ] |
| F-1 | Claude Code にリポジトリ権限を付与した | [ ] |
| F-2 | Cloudflare MCP の接続を確認した | [ ] |
| G-1 | ログインページの表示を確認した | [ ] |
| G-2 | OAuth 認証フローの動作を確認した | [ ] |
| H-1 | 変更をコミットした | [ ] |
| H-2 | プッシュした | [ ] |

---

## 変数一覧

本手順で使用する変数の一覧。作業開始時に値を決定して記入する。

| 変数 | 説明 | 値（記入欄） |
|---|---|---|
| `{N}` | 連番 | |
| `{OWNER}` | GitHub ユーザー名/Organization名 | |
| `{CF_SUBDOMAIN}` | Cloudflare Workers サブドメイン | |
| `{CLIENT_ID}` | GitHub OAuth App の Client ID | |
| `{CLIENT_SECRET}` | GitHub OAuth App の Client Secret | |
| `{JWT_SECRET}` | JWT署名用シークレット | |

---

*最終更新: 2026-03-07*
