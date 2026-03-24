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
| コールバックURLパス | `/auth/github/callback` |
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
- 本インスタンスでは `/auth/github/callback` を使用する

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
6. **SQLにコメントを入れない** — ユーザーに提示するSQL文、およびマイグレーション `.sql` ファイルに `--` コメントを含めない。D1コンソール等にそのまま貼り付けるとコメントが原因でエラーになるため
7. **owner が一意なら表中で省略する** — テーブル・リスト・チャート凡例等で `owner/repo` を表示する際、全データの owner が一意に決まる場合は表の外に「対象ユーザー : owner」と1回だけ表示し、表中では repo 名のみを表示する。owner が複数存在する場合はこの省略を適用しない
8. **catch で握りつぶすなら3つの義務を果たせ** — try/catch でエラーを握りつぶす（処理を続行する）こと自体は許容するが、以下を必ず守ること:
   - **記録**: エラー内容を呼び出し元が確認可能な場所に残す（DB、戻り値、ログのいずれか）。「何が起きたか」がどこにも残らない catch は禁止
   - **通知**: エラーが起きた事実をユーザーまたはシステムに伝達する手段を確保する（Slack通知、ダッシュボード表示、APIレスポンスのフィールド等）。ログだけでは不十分で、ログを常時監視しなくても異常に気づける仕組みが必要
   - **テスト**: catch に入るパターンが握りつぶしにならないことをユニットテストで検証する。特に「戻り値が空文字やnullにならないこと」をテストで保証する
9. **コード修正の前にテストを書け** — バグ修正・機能追加を問わず、コード変更の前にまず失敗するテストを書き、テストが通ることで修正の正しさを証明する。テストなしでデプロイして「動くはず」は禁止。テストが書けない構造なら、テスト可能な形に関数を抽出してからテストを書く
10. **D1の診断データを最初に見ろ** — バグ報告や異常の調査を始めるとき、コードを読む前にまず D1 の実データを確認する。`ai_summary_log`（要約結果・エラー情報）と `ai_summary_reviews`（自動診断レコード `reviewer_name='auto-diagnosis'`）には失敗原因が記録されている。推測でコードを修正する前に事実を確認すること
11. **推測するな、データで裏を取れ** — 「おそらく〜が原因」で修正に着手しない。D1クエリ、デプロイ済みWorkerコードの確認、Cloudflareドキュメントの参照など、利用可能な手段で仮説を検証してから修正する。特に以下を順に確認すること:
    1. D1 の `ai_summary_reviews` で自動診断コメントを確認（`[AI_ERROR]`, `[AI_NO_BINDING]` 等の分類）
    2. D1 の `ai_summary_log.summary` でエラー詳細を確認（`[AI_*]` プレフィックス付き文字列）
    3. デプロイ済みWorkerコード（Cloudflare MCP `workers_get_worker_code`）で実際に動いているコードを確認
    4. Cloudflare ドキュメント（`search_cloudflare_documentation`）でAPI仕様・モデル仕様を確認

---

## SPECファイル運用ルール

セッション中に行った修正・追加の仕様をまとめるドキュメント。

### 命名規則

```
SPEC.<リポジトリ名>.<YYYYMMDD>.md
```

例: `SPEC.cloudflare-workers-github-oauth-1.20260316.md`

### 記述ルール

1. **各セクションの冒頭に「対象」を明記する** — セクション見出しの直後に **太字** で「何を対象にしているのか」を1〜2文で書く。対象のエンドポイント、ファイル、UI要素、機能名などを具体的に示し、読者がセクション見出しだけでは判断できない文脈を補う
2. セクション見出しは「何をしたか」の要約とする（例: `GitHub App Webhook によるリアルタイム権限同期`）
3. 「背景」で「なぜその変更が必要だったか」を記載する
4. 「修正内容」で変更したファイルと変更概要を表形式で記載する
5. 「関連コミット」でコミットハッシュとメッセージを列挙する
6. 注意事項がある場合は「注意事項」として補足する

### 「対象」記述の書き方

```markdown
## 8. GitHub App Webhook によるリアルタイム権限同期

**対象**: `POST /webhook/github` エンドポイント、D1 `installation_permissions` テーブル、
`/repositories` および `/api/repo-permissions` の権限データ取得ロジック — GitHub App の
インストール権限変更を Webhook 経由でリアルタイムに D1 へ保存し、ページ表示時に GitHub API を
呼ばずに高速に権限データを返せるようにする。
```

- `**対象**:` で始める
- 対象物（エンドポイント、ファイル、UI要素等）を具体的に列挙する
- ダッシュ（`—`）の後に、変更の目的・効果を簡潔に記述する

---

## コミットハッシュのリンクルール

ドキュメント（`.md` ファイル）にコミットハッシュを記載する際は、**必ず GitHub のコミットページへのリンクを付ける**。
raw ファイル（`.sql`, `.ts`, `.json` 等のソースコード）は対象外。

### 書式

```markdown
[`abc1234`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/abc1234)
```

### 適用範囲
- SPEC ファイル
- API リファレンス
- HISTORY ファイル
- NOTICE ファイル
- README
- その他すべての `.md` ファイル

**例外なく適用すること。** コミットハッシュをバッククォートで囲んだだけの記載（`` `abc1234` ``）は禁止。

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
