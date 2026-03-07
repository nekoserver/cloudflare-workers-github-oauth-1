# CLONE_JOBS: Cloudflare Workers GitHub OAuth — 新規インスタンス構築手順

テンプレートリポジトリ `cloudflare-workers-github-oauth` から連番付き新規リポジトリを作成し、
GitHub OAuth App の認証情報を設定して Cloudflare Workers へデプロイするまでの全手順。

---

## 変数表（最初に埋めること）

作業開始時にすべて決定し、以降はこの表を参照する。

| 変数 | 説明 | 値（記入欄） |
|---|---|---|
| `{N}` | 連番 | |
| `{OWNER}` | GitHub ユーザー名 / Organization 名 | |
| `{CF_SUBDOMAIN}` | Cloudflare Workers サブドメイン（※1） | |
| `{CLIENT_ID}` | GitHub OAuth App の Client ID | |
| `{CLIENT_SECRET}` | GitHub OAuth App の Client Secret | |
| `{JWT_SECRET}` | JWT 署名用シークレット（`openssl rand -hex 32` で生成） | |

> ※1 Cloudflare Dashboard > Workers & Pages > Overview 右側に表示されている。

---

## 目次

| フェーズ | 内容 | 依存 |
|---|---|---|
| [A. リポジトリ作成](#a-リポジトリの作成とクローン) | GitHub リポジトリ作成、テンプレートクローン、リモート付替え | — |
| [B. OAuth App 作成](#b-github-oauth-app-の作成) | GitHub OAuth App 登録、Client ID / Secret 取得 | A |
| [C. プロジェクト設定](#c-プロジェクト設定の書き換え) | `wrangler.toml` 更新、コールバックURL確認 | A, B |
| [D. デプロイ](#d-依存関係のインストールとデプロイ) | `npm install`、`wrangler deploy`、疎通確認 | C |
| [E. シークレット設定](#e-cloudflare-シークレットの設定) | `wrangler secret put` × 3 | B, D |
| [F. Claude Code 設定](#f-claude-code-へのリポジトリ許可設定) | リポジトリ権限、MCP 接続 | A |
| [G. 動作確認](#g-oauth-フローの動作確認) | ログイン画面表示、OAuth フロー通し確認 | D, E |
| [H. コミット & プッシュ](#h-コミットとプッシュ) | 最終コミット、プッシュ | G |
| [T. トラブルシュート](#t-トラブルシュート) | エラー別の原因と対処 | — |

---

## 前提条件

- GitHub アカウントにログイン済み
- Cloudflare アカウントにログイン済み
- `wrangler` CLI インストール済み・`wrangler login` 済み
- `npm` が使用可能
- Claude Code（Web版 or CLI版）が使用可能

---

<details open>
<summary><h2 id="a-リポジトリの作成とクローン">A. リポジトリの作成とクローン</h2></summary>

### A-1. 連番の決定

GitHub 上の自分のリポジトリ一覧を確認し、`cloudflare-workers-github-oauth-{N}` の次の番号を決定する。
→ [変数表](#変数表最初に埋めること) の `{N}` に記入。

### A-2. GitHub でリポジトリを新規作成

- 名前: `cloudflare-workers-github-oauth-{N}`
- **プライベート**
- README / .gitignore の自動生成は **しない**

### A-3. テンプレートのクローンとリモート付替え

```bash
git clone https://github.com/{OWNER}/cloudflare-workers-github-oauth.git \
  cloudflare-workers-github-oauth-{N}
cd cloudflare-workers-github-oauth-{N}

git remote set-url origin https://github.com/{OWNER}/cloudflare-workers-github-oauth-{N}.git
git push -u origin main
```

#### チェック

- [ ] `git remote -v` で origin が新リポジトリを指している

</details>

---

<details>
<summary><h2 id="b-github-oauth-app-の作成">B. GitHub OAuth App の作成</h2></summary>

### B-1. OAuth App を新規登録

GitHub > Settings > Developer settings > OAuth Apps > **New OAuth App**

| 項目 | 値 |
|---|---|
| Application name | `cloudflare-workers-github-oauth-{N}` |
| Homepage URL | `https://cloudflare-workers-github-oauth-{N}.{CF_SUBDOMAIN}.workers.dev` |
| Authorization callback URL | `https://cloudflare-workers-github-oauth-{N}.{CF_SUBDOMAIN}.workers.dev/github/callback` |

### B-2. Client ID / Client Secret を取得

1. 登録直後の画面で **Client ID** をコピー → [変数表](#変数表最初に埋めること) に記入
2. "Generate a new client secret" → **Client Secret** をコピー → [変数表](#変数表最初に埋めること) に記入

> **Client Secret はこの画面でしか表示されない。必ずこの時点で記録する。**

#### チェック

- [ ] Client ID が `Ov23li` で始まる文字列である
- [ ] Client Secret が 40 文字の 16 進数文字列である

</details>

---

<details>
<summary><h2 id="c-プロジェクト設定の書き換え">C. プロジェクト設定の書き換え</h2></summary>

### C-1. wrangler.toml の name を更新

```toml
name = "cloudflare-workers-github-oauth-{N}"
```

検証: `grep '^name' wrangler.toml`

> **`name` を間違えるとデプロイ先が別 Worker になり、OAuth の redirect_uri mismatch が発生する。**
> → [T-1. redirect_uri mismatch](#t-1-redirect_uri-mismatch)

### ~~C-2. wrangler.toml の GITHUB_CLIENT_ID を更新~~

> **廃止**: `GITHUB_CLIENT_ID` は `[vars]` に書かず、[E-1](#e-cloudflare-シークレットの設定) で `wrangler secret put` に一元化する。
> 詳細は [T-5. vars と secret の競合](#t-5-vars-と-secret-の競合) を参照。

### C-3. コールバック URL パスの確認

ソースコード側のパスが `/github/callback` であることを確認する（通常変更不要）:

```typescript
// src/index.ts
const redirectUri = `${url.protocol}//${url.host}/github/callback`;
```

| 確認箇所 | 期待されるパス |
|---|---|
| GitHub OAuth App 設定画面 | `.../github/callback` |
| src/index.ts（`/auth/github` ルート内） | `/github/callback` |
| src/index.ts（`/github/callback` ルート内） | `/github/callback` |

> パスが不一致だと redirect_uri mismatch → [T-1](#t-1-redirect_uri-mismatch)

#### チェック

- [ ] `wrangler.toml` の `name` がインスタンス名と一致
- [ ] `wrangler.toml` の `[vars]` に `GITHUB_CLIENT_ID` が**存在しない**
- [ ] コールバック URL パスが GitHub 側とコード側で一致

</details>

---

<details>
<summary><h2 id="d-依存関係のインストールとデプロイ">D. 依存関係のインストールとデプロイ</h2></summary>

### D-1. npm install

```bash
npm install
```

### D-2. Cloudflare Workers へデプロイ

```bash
npm run deploy
```

デプロイ先 URL: `https://cloudflare-workers-github-oauth-{N}.{CF_SUBDOMAIN}.workers.dev`

### D-3. 疎通確認

```bash
curl https://cloudflare-workers-github-oauth-{N}.{CF_SUBDOMAIN}.workers.dev/health
```

#### チェック

- [ ] `node_modules/` が作成されエラーなし
- [ ] デプロイ成功、Worker URL が正しい
- [ ] `/health` が `{"status":"ok", ...}` を返す

</details>

---

<details>
<summary><h2 id="e-cloudflare-シークレットの設定">E. Cloudflare シークレットの設定</h2></summary>

3 つのシークレットをすべて `wrangler secret put` で設定する。
値は [変数表](#変数表最初に埋めること) を参照。

```bash
# E-1: Client ID（B-2 で取得済み）
npx wrangler secret put GITHUB_CLIENT_ID

# E-2: Client Secret（B-2 で取得済み）
npx wrangler secret put GITHUB_CLIENT_SECRET

# E-3: JWT Secret（事前に生成済み）
npx wrangler secret put JWT_SECRET
```

> **`wrangler.toml` の `[vars]` には絶対に書かない。**
> → [T-5. vars と secret の競合](#t-5-vars-と-secret-の競合)

### E-4. シークレット設定後の再デプロイ（必要に応じて）

```bash
npm run deploy
```

#### チェック

- [ ] 3 つの secret すべてで "Success" が表示された

</details>

---

<details>
<summary><h2 id="f-claude-code-へのリポジトリ許可設定">F. Claude Code へのリポジトリ許可設定</h2></summary>

### F-1. リポジトリ権限の付与

Claude Code（Web版）の設定にて `{OWNER}/cloudflare-workers-github-oauth-{N}` に以下を許可:

- 読み取り
- 書き込み
- コミット・プッシュ

### F-2. Cloudflare MCP の確認（任意）

Claude Code から Cloudflare 操作を行う場合は MCP 接続を確認。

#### チェック

- [ ] Claude Code からリポジトリにアクセスできる

</details>

---

<details>
<summary><h2 id="g-oauth-フローの動作確認">G. OAuth フローの動作確認</h2></summary>

### G-1. ログインページの表示

ブラウザで `https://cloudflare-workers-github-oauth-{N}.{CF_SUBDOMAIN}.workers.dev/` にアクセス。

### G-2. OAuth フローの通し確認

1. 「GitHub でログイン」をクリック
2. GitHub 認証画面が表示される
3. "Authorize" をクリック
4. `/welcome` にリダイレクトされる
5. ユーザー名・メールアドレスが表示される

エラーが出た場合 → [T. トラブルシュート](#t-トラブルシュート)

#### チェック

- [ ] ログインページが表示される
- [ ] OAuth フローが最後まで正常に完了する

</details>

---

<details>
<summary><h2 id="h-コミットとプッシュ">H. コミットとプッシュ</h2></summary>

```bash
git add -A
git commit -m "feat: initialize cloudflare-workers-github-oauth-{N}"
git push -u origin main
```

#### チェック

- [ ] GitHub 上のリポジトリに変更が反映されている

</details>

---

<details>
<summary><h2 id="t-トラブルシュート">T. トラブルシュート</h2></summary>

### T-1. redirect_uri mismatch

GitHub 側で「redirect_uri mismatch」と表示される。

| 原因 | 確認方法 | 対処 |
|---|---|---|
| `wrangler.toml` の `name` が別 Worker を指している | `grep '^name' wrangler.toml` | [C-1](#c-プロジェクト設定の書き換え) で修正して再デプロイ |
| コールバック URL パスの不一致 | GitHub OAuth App 設定画面とソースコードを比較 | [C-3](#c-プロジェクト設定の書き換え) で統一 |

### T-2. "GitHub OAuth is not configured"

`GITHUB_CLIENT_ID` が未設定。→ [E-1](#e-cloudflare-シークレットの設定) を実行。

### T-3. "Authentication failed"

`GITHUB_CLIENT_SECRET` が間違っている。→ [E-2](#e-cloudflare-シークレットの設定) を再実行。

### T-4. "Invalid state parameter"

CSRF state の不一致。ブラウザの Cookie をクリアして再試行。

### T-5. vars と secret の競合

`wrangler.toml` の `[vars]` に `GITHUB_CLIENT_ID` を平文で書くと、
`wrangler secret put` で設定した値と競合し、**`[vars]` 側が優先されてしまう**。

- `[vars]` から `GITHUB_CLIENT_ID` の行を**削除**する
- シークレットは `wrangler secret put` に一元化する
- 再デプロイして反映

### T-6. "JWT_SECRET is not configured"

`JWT_SECRET` が未設定。→ [E-3](#e-cloudflare-シークレットの設定) を実行。

</details>

---

*最終更新: 2026-03-07*
