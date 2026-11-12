# CLAUDE.md

設定・状態を扱う機能拡張では、[AGENTS.md「機能拡張の前提となる整合性と復元可能性」](AGENTS.md#機能拡張の前提となる整合性と復元可能性) を共通の最低品質として適用する。

OpenSSH・sshdの版や設定を変えるとき（`containers/demo`のDockerfile、`entrypoint.sh`、`sshd-hardening.conf`、`packages/openssh-*`）は、先に[NOTICE.openssh-update.20261106.md](NOTICE.openssh-update.20261106.md)を読む。

SSHとTailscaleの設定や鍵を変えるときは、[SSHのポリシー](POLICY.cloudflare-workers-github-oauth-1.security-ssh.20261106.md)と[Tailscaleのポリシー](POLICY.cloudflare-workers-github-oauth-1.security-tailscale.20261106.md)に従う。

`/aichat`の言語モデルの選択や、`/askmuse`・`◯_prompt=`の経路を変えるときは、[AGENTS.md「AIチャットの言語モデルスイッチとプレフィックス」](AGENTS.md#aiチャットの言語モデルスイッチとプレフィックス)に従う。

## コンテナビルドのルール

ユーザー指定（2026-11-06）: すべてのDockerfileとコンテナビルドに適用する。musevmで見つかった、取得元の404、失敗の隠蔽、効いていない設定の書き換え、実行ユーザーの権限不足を繰り返さないためのルール。

1. **固定した版が消える取得元に依存しない。** 最新版しか置かない配布先（例: `downloads.apache.org`）は、恒久的に残るアーカイブへのフォールバックを付けるか、リポジトリに保管した成果物を使う。
2. **外部から取得する物は版とハッシュで固定する。** ハッシュは上流が公開する値（リリースのdigest、チェックサムファイル）と照合する。ダウンロードした物から計算しただけの値を正としない。`curl | tar`のように検証なしで展開しない。
3. **版やURLを変えるときは、ビルドの前に取得できることを確かめる。** 変更したすべてのURLを`curl -fsSIL`で確認し、取得先と公開ハッシュの一致を確かめる。
4. **失敗を隠す書き方をしない。** `a && b || c && d`は、`a`や`b`の失敗後も後続を実行して成功扱いになる。`||`が必要な処理は`set -eu`の下に分けて書き、`if`で分岐する。`set -e`は`! cmd`の失敗では止まらない。
5. **設定の書き換えは結果を検査する。** `sed`は一致しなくても成功する。上流の実ファイルで一致を確かめ、書き換えの直後に`grep -q`で結果を検査する。
6. **実行ユーザーで動くことをビルド中に確かめる。** 非rootで動くサービスには、ログ、PID、ソケットの書き込み先の所有権を設定する。可能なサービスは、ビルド中に実行ユーザーで起動して応答を確認する。
7. **未実施のビルドを成功と報告しない。** Dockerビルドの実行条件が決まっている環境では、それに従う。実行できない場合は、確認した範囲と未確認であることを報告する。
8. **このコンテナではソースからビルドしない。** ユーザー指定（2026-11-07）。cf-container（standard-1）はCPUが足りないため、`./configure`・`make`・`cargo build`・`go build`などのコンパイルを、エージェントの作業でもイメージのビルドでも行わない。aptの版が古いなどでソースビルドが必要なものは、十分なCPUのある別のUbuntu 26.04 x86_64でビルドし、成果物を`containers/demo/packages/`に保管して、Dockerfileでは`COPY`とsha256の照合だけを行う（git・OpenSSH・Apacheと同じ方式。手順は`packages/README.md`）。2026-11-07にApache 2.4.70の試験ビルドをこのコンテナで行ったのが最後で、今後は行わない。

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

### GitHub API アクセス（環境によって違う）
- `gh` が使えるかどうかは環境によって違う。PRを作る前に `gh auth status` で確かめる
- **`gh` が認証済みの環境**（`GH_TOKEN` があるコンテナなど。2026-11-07 にこのコンテナで確認し、`gh pr create` で PR #2539 を作成できた）: `gh pr create` でPRを作成し、PRのURLを提示する
- **`gh` が認証されていない環境**（GitHub APIトークンが無い環境）: gitプロキシ（127.0.0.1:39093）は **gitプロトコルのみ** 対応で、REST APIは通らない。PRはブラウザから手動作成する。push後にcompareリンクを提示:
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

### 外部サービスへのアクセス頻度制限（必須）
- 外部URL・API・Webページへのアクセス頻度は **最低でも1秒あたり1回、最大でも3回** を上限とする
- 連続してリクエストを送る場合はリクエスト間に必ず 1 秒以上の間隔を空けること
- ループや再試行でも同じ制限を適用する。バースト送信は禁止
- WebFetch・fetch・curl・gh CLI など手段を問わず適用する

### 言語モデル設定
- このリポジトリの常用モデルは **`claude-sonnet-5`**（旧指定の `claude-sonnet-4-6` は廃止済みで指定不可）
- Sonnet 5 が週次リミットに達している間は、代替として提供されるモデル（Fable 5 等）をそのまま使ってよい。使い切っても構わない
- モデルを固定するための `/model` 再実行は不要。エージェントは実際に動作しているモデル名をそのまま名乗ってよい

---

## 過去のトラブルと教訓

### wrangler.toml の name 不一致 → redirect_uri mismatch
- テンプレートからクローン後 `wrangler.toml` の `name` を更新し忘れると
  デプロイ先が別の Worker になり、GitHub OAuth App のコールバックURLと不一致になる
- **クローン直後に `wrangler.toml` の `name` を必ず確認・修正すること**

### コールバックURLパスの不一致
- GitHub OAuth App 側の callback URL パスとソースコード側のパスは必ず統一する
- 本インスタンスでは `/auth/github/callback` を使用する

### Worker ドメインの運用ポリシー
- 開発時は `xxx.workers.dev` のワーカー用ドメインで作業する
- 本番環境に移行する段階ではじめてワーカールートやカスタムドメインの割り当てがはっきりし次第、環境変数等でワーカールートを設定する
- コード内の `WORKER_BASE_URL` 等のハードコード値は開発用ドメインのまま維持し、本番移行時に環境変数で上書きする想定

### GITHUB_CLIENT_ID を wrangler.toml [vars] に平文で書いてはいけない
- `GITHUB_CLIENT_ID` は `wrangler secret put` で暗号化管理する
- `wrangler.toml` の `[vars]` に平文で書くと、secret と競合して意図しない値が使われる
- **`[vars]` には GITHUB_CLIENT_ID を絶対に書かない。secret に一元化すること**
- `.dev.vars.example` にも実際の値を書かない（プレースホルダーのみ）

---

## PWA UI ルール

- **画面右上のリンクは撤去する** — PWA版アプリ（`display: standalone` で起動されるページ）の画面右上には外部リンク・ナビゲーションリンクを一切配置しない。PWAとして表示した場合、ブラウザのアドレスバーがないため右上リンクはデッドリンクになりやすく、UXを損なう。新しいページ・コンポーネントを追加するときも同じルールを守ること。
- **ページ最上部のナビゲーション帯は高さ `44px` で固定表示する** — 他ページの中で最も上下幅が狭い帯に合わせ、`position: sticky; top: 0` を指定して、ページをスクロールしても画面から消えないようにする。帯内のアバターやボタンは `44px` を超えない寸法にすること。

---

## CSS / UI スタイリングルール

詳細は [`CLAUDE.CSS.md`](CLAUDE.CSS.md) を参照。
**CSS を書く前・スクリーンショットで表示異常を受け取った時は必ず読むこと**。
特に「固定色禁止・CSS変数の使用」「ダークモード目視確認」「スクリーンショットを最初に読む」は再発防止の最重要ルール。

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
2. **PRの作り方は `gh auth status` で決める** — `gh` が認証済みなら `gh pr create` で作成してPRのURLを提示する。認証されていなければ、ブラウザで作成してもらうためcompareリンクを提示して終わり（「Claude Code 環境の制約事項」の「GitHub API アクセス」を参照）
2a. **PRマージ通知を画面に積み上げるな** — `subscribe_pr_activity` / `mcp__github__subscribe_pr_activity` は **絶対に呼ばない**。マージ済みPR通知はClaude Codeのウェブ画面に消せない形で蓄積しユーザー体験を著しく損なう。PRを作成したらPRのURL（`gh` が使えない環境ではcompareリンク）を提示して終わり。その後の監視・自動マージ・CI追跡はすべてユーザーに委ねる
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
9. **コード修正の前にテストを書け、pushの前にテストを走らせろ** — バグ修正・機能追加を問わず、コード変更の前にまず失敗するテストを書き、テストが通ることで修正の正しさを証明する。テストなしでデプロイして「動くはず」は禁止。テストが書けない構造なら、テスト可能な形に関数を抽出してからテストを書く。**`git push` の直前に必ず `npx vitest run` を実行し、全テストが通ることを確認してからpushすること**。テスト失敗を放置してpushすることは禁止。詳細なテスト方針は [`CLAUDE.cloudflare-workers-github-oauth-1.TESTPOLICY.md`](CLAUDE.cloudflare-workers-github-oauth-1.TESTPOLICY.md) を参照
10. **D1の診断データを最初に見ろ** — バグ報告や異常の調査を始めるとき、コードを読む前にまず D1 の実データを確認する。`ai_summary_log`（要約結果・エラー情報）と `ai_summary_reviews`（自動診断レコード `reviewer_name='auto-diagnosis'`）には失敗原因が記録されている。推測でコードを修正する前に事実を確認すること
11. **進捗を報告しろ** — 調査・実装を問わず、**ツール呼び出し2〜3回ごと、または体感1分ごと**に「今何をしているか」「何がわかったか」「次に何をするか」をユーザーに報告する。長時間黙って内部で推測を繰り返し、成果もなくトークンと時間だけ消費するのは禁止。行き詰まったら即座にユーザーに状況を伝え、方針を相談する
12. **推測するな、データで裏を取れ** — 「おそらく〜が原因」で修正に着手しない。D1クエリ、デプロイ済みWorkerコードの確認、Cloudflareドキュメントの参照など、利用可能な手段で仮説を検証してから修正する。特に以下を順に確認すること:
    1. D1 の `ai_summary_reviews` で自動診断コメントを確認（`[AI_ERROR]`, `[AI_NO_BINDING]` 等の分類）
    2. D1 の `ai_summary_log.summary` でエラー詳細を確認（`[AI_*]` プレフィックス付き文字列）
    3. デプロイ済みWorkerコード（Cloudflare MCP `workers_get_worker_code`）で実際に動いているコードを確認
    4. Cloudflare ドキュメント（`search_cloudflare_documentation`）でAPI仕様・モデル仕様を確認
    - 上記の確認プロセス中も、ルール11に従い各ステップの結果をユーザーに逐次報告すること
14. **D1に新テーブル・カラム追加が必要な場合はコピペ可能なSQL文を明示しろ** — マイグレーション `.sql` ファイルを作るだけでは不十分。ユーザーが `wrangler d1 execute` でそのまま実行できる一文のSQL（セミコロン含む完全な文）を、コードブロックで提示すること。マイグレーションファイルの存在を暗黙に前提とせず、「このSQLを実行してください」と明示的に伝える
15. **テスト対象のロジックは関数に切り出してからテストしろ** — ルートハンドラやコールバック内にロジックを直書きしたままテストを書くと、モック地獄になりテストの信頼性が下がる。テストしたいロジックはまず純粋関数として切り出し、入出力だけでテストできる形にする。関数抽出→ユニットテスト→ハンドラから呼び出し、の順で進めること
16. **罫線・ツリー文字を使うな、Markdownテーブルで統一しろ** — Slack Block Kit・モーダル・通知など外部サービスに出力するテキストで、`├` `└` `│` `▼` `─` 等の罫線・ボックスドローイング文字やASCIIツリー文字を使わない。環境・フォント・表示幅によって崩れる。構造化データの表現には **Markdownテーブル**（`| col1 | col2 |` 形式）を使うこと。Slack の `mrkdwn` はテーブル記法を直接サポートしないため、コードブロック（` ``` `）内に等幅Markdownテーブルを入れるか、箇条書き（`•` + インデント）でフラットに表現する。見た目の装飾より可読性を優先する
17. **`/status` モーダルの全テーブルの `<th>` にPK/FK/UK/IDXバッジを表示する** — 保存データモーダルのテーブルヘッダーには、ER図（`er-diagram.html`）と同じ配色でPK/FK/UK/IDXバッジを表示する。対象はAI関連テーブルに限らず**全テーブル**に適用する。新しいテーブルを追加した場合は `TABLE_COLUMN_KEYS`（`src/index.ts`）にもPK/FK/UK/IDX定義を追加すること。配色: PK=`background:#ffebe9; color:#cf222e`、FK=`background:#ddf4ff; color:#0969da`、UK=`background:#fff8c5; color:#9a6700`、IDX=`background:#f0f0f0; color:#656d76`、PK+FK=両バッジ並列表示
18. **PR作成時のタイトル・本文は日本語で記載し、末尾は必ずGitHub番号で終わらせる** — `make_pr` を使ってPR本文を作るときは、タイトル・概要・変更点・テスト結果をすべて日本語で書く。英語テンプレートをそのまま使わず、このリポジトリの既存ドキュメント（日本語中心）と同じトーンに合わせること。本文末尾の「関連」セクションには必ず `closes #番号` または `refs #番号` を記載する。対応するIssueが存在しない場合はPR作成前にIssueを起票するか、紐付けない理由を「関連」セクションに明記すること。`.github/PULL_REQUEST_TEMPLATE.md` のテンプレートに従って記載すること
19. **AI要約は英語のPRを先に翻訳してから日本語で要約する** — AI要約機能では、プルリクエストのタイトル・本文・差分が英語で書かれていた場合、まず日本語に翻訳し、その翻訳内容を基に要約すること。Slackには英語の原文や英語の要約をそのまま投稿せず、最終的な日本語の要約だけを書き込むこと。今後の修正でもこの処理順と出力言語を維持すること
20. **コミットログ（コミットメッセージ）は日本語で記録する** — `git commit` 時のメッセージは件名・必要に応じた本文を含めて日本語で記載する。英語の定型文を避け、変更意図が日本語で追跡できる状態を維持すること
21. **Codexを含むすべてのエージェントはプルリクエストを日本語で記録する** — プルリクエストのタイトル・本文・レビューコメント・補足説明は必ず日本語で記載する。CodexやClaude Codeなどが自動生成する場合も、英語の定型文やテンプレートをそのまま投稿せず、日本語に直してから投稿し、議論と決定事項を日本語で追跡できる状態を維持すること
22. **`/status` の保存データモーダルで commit系 `request_id` は必ず `/ai-summary/{id}` 形式でリンク化する** — `commit_agent_log` を含む commit系テーブル（`commit_` プレフィックスのテーブル）で `request_id` カラムを表示する場合、値はプレーンテキストで出さず、すべて `/ai-summary/{id}` へのリンクとして描画すること。将来テーブルが追加されても同じルールを適用する
23. **`/status` テーブル一覧のステータス表示は3状態を厳密に区別する** — テーブルの状態を以下の3パターンで表示し、混同しないこと。テストで各状態の表示が正しいことを保証する:
    - **OK（緑）**: テーブルが存在し、`COUNT(*)` 等のデータ読み出しに成功（`exists=true, rowCount=数値`）
    - **NG（赤背景バッジ）**: テーブルは存在するが、データ読み出しに失敗（`exists=true, rowCount=null`）。CSSクラス `status-ng`
    - **未作成（赤文字）**: テーブル自体が存在しない（`exists=false`）。CSSクラス `status-missing`
    - 新しいテーブルを `STATUS_TABLE_DEFINITIONS` に追加した場合、同時に `TABLE_COLUMN_KEYS`・`TABLE_GROUP_MAP`・`COLUMN_FK_TARGETS`・`STATUS_MIGRATION_SQL` への登録も必須。登録漏れは `/status` に表示されない原因になる
24. **PR マージ後に `repo_commit_index` を更新する（本体リポジトリ・`nekoserver/dynamicneko`・`nekoserver/cf-auth` の3つが対象）** — PR がマージされるたびに（または新規コミットが main に追加されるたびに）、`SPEC.cloudflare-workers-github-oauth-1.COMMITDB.md` の手順に従い、D1 の `repo_commit_index` テーブルに新規コミットを追記すること。**本体リポジトリ（`repo_name='nekoserver/cloudflare-workers-github-oauth-1'`）だけでなく、`nekoserver/dynamicneko`（`repo_name='nekoserver/dynamicneko'`）・`nekoserver/cf-auth`（`repo_name='nekoserver/cf-auth'`）で新規コミットがあった場合も同じ手順で追記する**（2026-09-11 に `nekoserver/cf-auth` 69件・`nekoserver/dynamicneko` 120件の過去分を一括投入済み）。**`nekoserver/dynamicneko` と `nekoserver/cf-auth` は別の実在リポジトリであり同一視しないこと**（NOTICEファイル中の「`nekoserver/dynamicneko`の`cf-auth`」という表記を「dynamicneko = cf-authの通称」と誤読して取り違えた実績あり）。手順の要点: (1) 対象リポジトリの `repo_name` で `SELECT MAX(seq_num) WHERE repo_name = ?` して現在の最大値 N を取得、(2) 対象リポジトリの `git log main --reverse --format="%H|||%s" | tail -n +$((N+1))` で新規コミット一覧を取得、(3) `INSERT OR IGNORE`（`repo_name` を対象リポジトリの値にする）で追記、(4) `COUNT(*) WHERE repo_name = ?` と対象リポジトリの `git rev-list --count main` が一致することを確認。`repo_name` は必ず `owner/repo` 形式（`nekoserver/...`）で統一し、オーナー名なしの表記（例: `cloudflare-workers-github-oauth-1` 単体）は使わないこと（2026-09-11 にこの表記揺れで本体分の2件が分裂していたのを修正した実績あり）。
25. **Cookie のセキュリティ属性（`Secure`・`HttpOnly`・`SameSite`）を削除・緩和するな** — 「開発環境で動かない」「HTTP で動かない」といった理由で `Secure` フラグや他のセキュリティ属性を除去・弱体化することは**絶対に禁止**。開発環境固有の問題は環境側（HTTPS 化・プロキシ設定等）で解決するか、バグの真因を特定してから対処すること。セキュリティ属性の除去は「修正」ではなくセキュリティ退行であり、コードレビューで即リジェクトされる種類の変更である。発見した場合は除去せずに別の原因を調査すること。
26. **モーダルの z-index は固定値で書かず `getNextZ()` で動的に算出する** — UI に複数のモーダル・オーバーレイが重なる場合、固定 z-index（例: `z-index:1100`）を直書きすると「後から開いたモーダルが既存モーダルの裏に入る」バグを引き起こす。このリポジトリでは以下の原則を普遍的に適用する:
    - **`getNextZ()` 関数**: DOM 上のすべての `position:fixed` 要素と既知の静的モーダルの現在の z-index を走査し、最大値 + 100 を返す。新しいオーバーレイを開く直前に呼ぶこと。
    - **動的オーバーレイ（`document.createElement` で生成）**: `overlay.style.cssText` に `z-index:` + `getNextZ()` を使う。絶対に固定値を書かない。
    - **静的モーダル（HTML に `id` がある要素、`classList.add('open')` で表示）**: 開く直前に `el.style.zIndex = String(getNextZ())` をセットしてから `classList.add('open')` を呼ぶ。
    - **新しいモーダルを追加するときは `getNextZ()` の `staticZDefaults` マップにも登録する**。登録漏れがあると getNextZ() が開いているモーダルを見落とし、次のモーダルが裏に入る原因になる。
    - この原則はページ内のすべてのモーダル・ドロワー・ポップアップに適用する。例外は作らない。
27. **ユーザー設定値の解決順序は「D1 優先 → Cookie → ハードコードデフォルト」に統一する** — タイムゾーン・セッション有効期限など、設定ページで変更できるユーザー設定値をサーバーサイドで解決する際、**必ず D1（`user_sessions` 等）の値を最優先し、Cookie はその次のフォールバック、ハードコードのデフォルト値（`'1h'` 等）は最終手段**とする。Cookie はログアウト時に削除されるため、Cookie のみに依存する実装は「設定ページでの変更が再ログイン後にリセットされる」バグを引き起こす。解決ロジックは `resolveSessionDuration` のように専用関数に切り出し、有効値のバリデーションを含めること。フォールバック解決が必要な設定値を新たに追加するときは、同じパターンに従うこと。
28. **`/api/*` 配下のルートは全て `api_endpoint_stats` テーブルへ自動集計される（追加作業不要）** — `src/index.ts` には Hono ミドルウェア `app.use('/api/*', ...)` が登録されており、すべての `/api/` 配下のリクエストはハンドラ完了後に `recordApiAccess()` が `executionCtx.waitUntil()` 経由で呼ばれ、`api_endpoint_stats` テーブルに `"METHOD /route/pattern"` キーで成否ステータスコードとともに集計される。新しい `/api/` ルートを追加した場合は**何も追加しなくてよい**。ただし `/api/` 以外のパス（例: `/webhook/...`, `/slack/...`, `/s/:id`）を集計対象に加えたい場合は `recordApiAccess(c.env.DB, c.req.method, c.req.routePath, c.res.status)` を当該ハンドラ内で明示的に呼ぶこと（`waitUntil` でラップすること）。また `api_endpoint_stats` テーブルは `D1` に migration `0056` で作成される。テスト環境では `executionCtx` が存在しないため集計はスキップされ（`try/catch` で保護済み）、テストが 500 になることはない。
29. **TypeScript の template literal 内に JavaScript コードを埋め込む場合はエスケープ文字を必ずチェックしてから push すること** — このリポジトリでは `src/views/*.ts` がHTMLページ全体をTypeScriptのtemplate literal（`` ` `` ... `` ` ``）として返す構造になっている。template literal 内では `\n`・`\'`・`\"` 等のエスケープシーケンスが TypeScript によって処理され、意図しない文字変換が起きる。これにより生成された HTML の `<script>` ブロックに構文エラーが生じ、ページ全体が白紙になる。**必ず以下のルールに従うこと**:
    - **`\n`** → template literal 内では改行文字になる。JS文字列リテラル中で改行が必要な場合は `'\\n'` と書くと出力で `'\n'` になる
    - **`\'`** → template literal 内では `'` になる。`'\''` のような単引用符エスケープは出力で `'''` になりJS構文エラーになる。**HTML属性内の onclick 等で単引用符が必要な場合は `&#39;` エンティティを使うこと**（ブラウザがJS実行前に `'` へ復元する）
    - **`\"`** → template literal 内では `"` になる。同様に注意が必要
    - **regex リテラルの `\` 系**: `/[.*+?^${}()|[\]\\]/g` 等の正規表現は template literal 内で `\\` が `\` になるため、正規表現が壊れる。**template literal 内にリテラルで正規表現を書かず、indexOf ループ等で代替すること**
    - **`git push` 直前に以下を確認する**: template literal 内に新たに追加したコードに `\'`・`\"`・`\n`（単独）・バックスラッシュ系 regex が含まれていないかを grep 等で検索してから push すること
30. **`/welcome` ページのドロップダウンメニューにユーザーの許可なくリンクを追加しない** — 新規ページ（`/harness-log`、`/base64` 等）を作成する依頼を受けても、`src/views/welcome.ts` のナビゲーションドロップダウン（`.dropdown-menu` 内の `<a class="dropdown-item">` 一覧）へのリンク追加は**依頼された作業の範囲外**であり、ユーザーが明示的に「ナビにも追加して」等と頼まない限り行わないこと。ページを作る＝そのページへの導線も自動的に整備してよい、という判断を自分で下さない。導線が必要かどうかはユーザーが決めることであり、勝手に判断して実装しすぎる典型パターンとして戒める。
31. **チャット本文に貼るURL・リンクの行末に余計な文字列を付けない** — PRリンクやコミットリンクをチャットメッセージ中に貼るとき、URLの直後に句読点・かっこ閉じ・箇条書き記号・説明文などを続けて書くと、クライアントによってはそれらの文字列がURLの一部として誤認識され、リンクが壊れる（クリックできない/誤ったページに飛ぶ）。**URLを貼る行はURLだけで完結させる**か、URLの前に十分な区切り（改行やコロン）を入れ、URLの直後に文字を続けないこと。同じ行で補足説明をしたい場合はURLを先頭に置かず、`- PR: https://...`のように末尾に置く、または別行に分けること。Markdownリンク記法 `[表示テキスト](URL)` を使う場合も、`)` の直後に文字を続けない。
32. **エラー種別は文字列prefixではなく判別可能な型（discriminated union）で表現しろ** — 関数の失敗を`"[AI_ERROR] ..."`のような**文字列の先頭に埋め込んだラベル**で表現し、呼び出し元がそれを`startsWith()`で判定する設計を禁止する。この方式は次の問題を生む: (1) 判定ロジック（`startsWith`）が複数箇所に分散すると、prefixの追加・変更を1箇所で直し忘れて食い違う（実例: `runSummaryPipeline`が全`[AI_`prefixを一括判定する一方、`classifySummaryResult`は`[AI_ERROR]`/`[AI_EMPTY_RESPONSE]`/`[AI_UNEXPECTED_FORMAT]`の3種だけを個別`startsWith`で判定しており、後から追加された`[AI_NO_BINDING]`がどちらにも網羅されず「正常」に誤分類されていた）。(2) 正常な戻り値がたまたま同じprefixで始まる可能性を型システムが排除できず、実行時にしか気づけない。(3) テストが「意味」ではなく「見た目の文字列パターン」を検証することになり、表示文言のリファクタリングだけでテストが壊れる/逆に壊れているのに気づけない。代わりに成功/失敗を型で表現すること:
    ```ts
    type Result<T, E extends string> =
      | { ok: true; value: T }
      | { ok: false; errorCode: E; detail: string };
    ```
    - 呼び出し元は`result.ok`で分岐し、文字列マッチを一切使わない
    - エラー種別（`errorCode`）は`enum`かunion literal型で列挙し、新しい失敗パターンを追加する際はコンパイラがすべての判定箇所の網羅漏れを検出できるようにする（`switch`の`default`で`never`型にフォールスルーさせる等）
    - D1保存やSlack表示など「人間が読む文字列」が必要な場面では、この構造化結果から**最後の1箇所でだけ**表示用文字列を組み立てる。表示用文字列を判定に使い回さない
    - 既に永続化された文字列（D1に保存済みの過去データ等）を後から分類する必要がある場合は、prefixのリストを判定ロジックの側で共有配列・共有関数として1箇所にまとめ、複数箇所にハードコードしない
33. **自動アップロードしてよいものとよくないものを区別しろ** — `/opt/cursor/artifacts` への配置・PR本文への成果物埋め込み・リポジトリへの追加は、自動アップロード対象だけに限る。詳細は「自動アップロード対象の区別」を参照。D1貼り付け用SQLやコピー用の一時ファイルを成果物やGitに載せない
34. **push・コミット追加の前に、そのブランチのPRが既にマージ/クローズ済みでないか必ず確認しろ** — 既存ブランチへ追加のコミットをpushする前に、対応するPRの状態（`state`/`merged`）を確認すること。マージ済み・クローズ済みのPRへは、後からpushしても自動で取り込まれない（PRが再オープンされない限りマージ対象にならず、そのコミットは宙に浮く）。作業対象のブランチが既にマージ/クローズされていた場合は、そのブランチに直接pushせず、**最新のdefaultブランチから新しいブランチを作り直し**（必要なら未マージ分のコミットを`git cherry-pick`で移植）、新規PRとしてpushすること（実例: PR #1869がマージ済みと気づかずに同じブランチへ追加コミットをpushしてしまい、`/wasm-modules`ページへのレジストリ登録が取り残され、PR #1870として作り直す羽目になった）。
35. **`/json-structural-diff` ページ（gron-wasm × go-diff-wasmによるJSON構造差分表示）は原則使わない** — オブジェクトのキー順は`gronToGron`がソートするため無視されるが、**配列の要素順序は無視されない**（`json.arr[0]`のようにインデックスをそのまま使うため、要素の並び替えだけでも差分ありと表示される）。「構造的な差分だけを見せる」という見た目に反して配列を含むデータでは誤解を招きやすく、ユーザー判断により本番運用では使用しない方針とした。ページ自体（PR #2043）・土台の`gron-wasm`/`go-diff-wasm`（PR #2042）は削除せず残っているが、新規に頼るロジックを組む際はこのページの出力を正しさの根拠にしないこと。配列も正規化して比較したい場合は、`gron-wasm`側に配列ソートオプションを追加する改修が別途必要（未着手）。
36. **「対象リポジトリの一覧」をコード内に固定配列でハードコードするな。都度D1を参照して現在値を求めろ** — `nekoserver/dynamicneko`・`nekoserver/cf-auth`のように具体的なリポジトリ名を列挙した`as const`配列をAPIの許可リストとして使う実装は、新しいリポジトリが増えても(逆に減っても)追随できず、コード修正とデプロイが無ければ永久に古いままになる。実例: `COMMIT_SUMMARY_ALLOWED_REPOS`という3件固定の配列が`/api/commit-summary-external`・`/api/jev-test-score-external`・`/api/jev-test-score-trend-external`のrepoName検証に使われており、`nekoserver/rust-worker-sqlx-d1`を新たに追跡対象へ加えても一覧に反映されず、dynamicnekoのtree-viewコミット履歴モーダルの「推移」リンクが「repoNameは次のいずれかである必要があります」という400エラーで弾かれ続けていた(2026-10-01、ユーザー指摘で発覚・修正)。
    - 対処: `installation_permissions`(GitHub App webhookのinstallation/installation_repositoriesイベントで自動更新される、現在インストール済みのリポジトリ一覧)のように**自動更新されるテーブル**を都度クエリして許可リストを組み立てる(`loadCommitSummaryAllowedRepos()`、`src/utils/commitSummaryAllowedRepos.ts`参照)。`repo_commit_index`のような手動運用テーブル(ルール24参照)は「過去に1件でもコミットが記録されたか」を表すだけで、新規追加直後でコミット未登録のリポジトリが弾かれてしまうため、この種の「有効なリポジトリかどうか」の判定には使わない
    - 同様のパターンを新たに実装するときは、「このリストは将来リポジトリが増減したときに自動で追随するか」を自問してから固定配列を選ぶこと。対象リポジトリの集合が将来変わりうる場面(権限チェック・許可リスト・ドロップダウンの選択肢等)では、コード変更を要する固定値ではなく、その時点のD1の実データを参照する設計をデフォルトにする

37. **ユーザーが承認していない環境変数・設定スイッチを勝手に追加するな** — 「将来こういう切り替えが必要になるかもしれない」「ついでに汎用化しておこう」という自分の判断だけで、新しい`env.XXX`(`wrangler.toml`の`[vars]`・secret問わず)やそれに紐づく分岐ロジック(`if (env.XXX === ...) { ... } else { ... }`のような経路分岐)を実装に組み込まない。実例: `NOTIFY_TARGET`(通知先をSlack直接送信と外部Worker中継のどちらにするかの切り替え変数、`src/utils/notifyDispatch.ts`)をユーザーに相談せず導入していたため、後から`/tsubuyaki`がSlackへ投稿できない不具合を調査した際、原因が「この変数の値によって経路が変わるのではないか」という誤った仮説に基づく無駄な調査・無駄なPR作成を複数回引き起こし、ユーザーの時間を奪った(2026-10-02)。該当の不具合自体は`NOTIFY_TARGET`とは無関係な別の設定(`notification_settings.slack_enabled`)が原因であり、`NOTIFY_TARGET`はそもそも一度も使われていなかった。
    - 新しい設定スイッチが必要だと判断した場合は、まずユーザーに「〇〇のためにこういう環境変数/設定を追加したいが良いか」と確認してから実装すること。新しい設定軸の導入はコードベース全体の分岐パターンを恒久的に増やす行為であり、「副作用がない」操作とは言えない
    - 既に導入済みで後から「頼んでいない」と指摘された設定スイッチがあっても、使われている箇所が複数(このリポジトリでは9箇所以上+専用の診断ページ)に及ぶ場合は、ユーザーの許可なく全面撤去もしない(ドミノ式に他の機能を壊す)。まずユーザーに影響範囲を提示し、全面撤去か部分的な縮小かの判断を仰ぐこと(本ルールの元になった実例でも、調査の末に本体機能は撤去せず温存する判断になった)
    - 不具合調査の際、「複雑な設定スイッチが絡んでいるのでは」という仮説を立てる前に、まずその設定スイッチが実際にその経路のコードで参照されているかをコード上で確認してから仮説を話すこと。参照されているかどうかを確認せずに仮説を口に出すと、ユーザーに無駄な確認作業(ダッシュボードでの値確認等)を強いることになる
    - **根本原因はルール9(テストファースト)を守れていないこと**。`NOTIFY_TARGET`のような「将来必要になるかもしれない」設定スイッチは、それを要求する具体的な失敗するテストが先に無いまま実装に紛れ込む。ルール9の通り、まず「この切り替えが無いと落ちるテスト」を書き、それをユーザーに見せて合意を得てから実装する運用を徹底すれば、本当に要求されていない設定スイッチはそもそもテストが存在せず書けないため、この種の無断追加自体が構造的に起こらなくなる。「テストを書いてから直す」ではなく「このテストが通らないと困る、という合意を先に取ってからテストを書く」まで一歩手前から始めること
38. **ワーカー間リクエストの認証は「`CF-Worker`ヘッダー + HMAC照合」を基準方針とする** — 本Worker(`nekoserver/cloudflare-workers-github-oauth-1`)と他Worker(`nekoserver/dynamicneko`・`nekoserver/cf-auth`・`rust-worker-sqlx-d1`)の間のリクエストは、以下を**新規に追加するエンドポイントのデフォルト方式**とする(現状分析は[`SPEC.cloudflare-workers-github-oauth-1.20261008.worker-auth-policy.md`](SPEC.cloudflare-workers-github-oauth-1.20261008.worker-auth-policy.md)参照)。
    - 呼び出し元は`CF-Worker: <worker名>`(例: `dynamicneko`)・`CF-Worker-Timestamp: <UNIX秒>`・`CF-Worker-Signature: sha256=<hex>`の3ヘッダーを付ける。署名対象は`"{CF-Worker}\n{CF-Worker-Timestamp}\n{METHOD}\n{PATH}\n{rawBody}"`、アルゴリズムはHMAC-SHA256(`crypto.subtle`)
    - 受信側は`verifyGitHubWebhookSignature`(`src/utils/githubWebhook.ts`)と同じ**タイミングセーフ比較**(`mismatch |= a ^ b`形式、単純な`===`/`!==`比較は禁止)を使い、`CF-Worker-Timestamp`が現在時刻から一定範囲(目安±5分、`redmineSignature`と同程度)を超えていれば拒否してリプレイを防ぐ
    - シークレットは**機能ごとではなく呼び出し元Workerごとに1つ**(例: `CF_WORKER_SECRET_DYNAMICNEKO`)発行する。新しい`-external`エンドポイントを追加するたびに新しいシークレット環境変数を発行する現状の運用(`AICHAT_EXTERNAL_SECRET`・`KIMI_CODE_EXTERNAL_SECRET`等)は増やさない
    - 既存の静的Bearer方式(`AICHAT_EXTERNAL_SECRET`・`CF_AUTH_WEBHOOK_SECRET`・`NOTIFY_WORKER_SECRET`等、本文を署名対象にせず単純比較のみ)は**後方互換のため残してよいが、新規追加はしない**。既存分の移行は呼び出し元リポジトリ側の送信コードも同時に変更する必要があるため、個別タスクとして計画すること
    - rust-worker-sqlx-d1が自ら署名してtunnels.rbへ送る`ORIGIN_HMAC_SECRET`(本Workerはシークレットを扱わない中継のみ、`src/utils/tunnelSignerAsk.ts`)はこの方針の対象外(他リポジトリの実装に委ねる)

39. **`containers/**`・`src/containers/**`・`src/views/cfContainers.ts`・`wrangler.toml`の`[[containers]]`を変更したら、push前に`bash scripts/check-cf-containers.sh`を必ず実行して`ALL OK`を確認しろ** — Workers BuildsのPRビルド(`wrangler versions upload`)はコンテナイメージをビルドしないため、検証せずにmainへマージすると本番ビルドが一発勝負になる(実例: 2026-10-16〜17、#2389以降の本番ビルド失敗、Apacheが8443で待ち受けていない不具合、ページscriptの構文エラーがいずれもマージ後に発覚した)。このスクリプトは関連テスト・Workerのバンドル(`wrangler deploy --dry-run`)・Dockerfileのビルド・コンテナ起動後の`/health`と8443確認を行う。Claude Codeのクラウドサンドボックスでも、スクリプトがプロキシのCAを注入して本番と同じダウンロード込みでビルドする。`--offline`(ダウンロードを除外)は検証不足なので、使った場合はその旨を報告に明記すること。GitHub Actionsは、demoコンテナのパッケージ(`demo-packages`)とイメージ(`container-image`)を作り直す2つのワークフローにだけ使う(ユーザー承認、2026-11-11。`SPEC.cloudflare-workers-github-oauth-1.20261111.container-auto-build.md`)。テストのCIには使っていないので、CIに頼らないこと
    - **Dockerビルドの前提処理(ユーザー指定、2026-10-31)**: ビルドの前に、ルール44の前提処理を必ず通す。(1) ドキュメントだけの変更では、本番のビルドを走らせない。(2) 公式のコンパイル済みのバイナリを使い、ソースビルドは許可の表(`src/cf-containers-source-build-allowlist.test.ts`)にあるものだけにする。(3) 取得物をsha256で照合する。(4) 外部ツールの版と、契約テストの版を一致させる。(2)〜(4)は`npx vitest run src/cf-containers`で検査され、エージェントの`git push`の前に`scripts/claude-push-guard.js`が自動で走らせる。詳細は[`SPEC.cloudflare-workers-github-oauth-1.20261031.docker-build-preconditions.md`](SPEC.cloudflare-workers-github-oauth-1.20261031.docker-build-preconditions.md)

40. **コンテナイメージは「1レイヤー800MB以下」「イメージ全体がinstance_typeのディスク上限以下」を必ず守り、`scripts/check-cf-containers.sh`のサイズ検査でOKを確認してからpushしろ** — 本番ビルドは**イメージのビルド自体は成功しているのに**、`registry.cloudflare.com`へのレイヤーのアップロードが`net/http: timeout awaiting response headers`で失敗し続けていた(2026-10-16〜17、#2389〜#2398)。原因は、apt・cloudflared・tailscale・npm(Codex/Claude CLI)を`RUN`1つにまとめた**1.9GBの単一レイヤー**で、送り切れるかどうかは毎回変わるため成功と失敗が混在した(#2402でレイヤーを分割して解消。詳細は[`NOTICE.cloudflare-workers-github-oauth-1.20261017.md`](NOTICE.cloudflare-workers-github-oauth-1.20261017.md))。
    - Dockerfileでは、大きなインストール(apt・外部バイナリ・`npm install -g`のパッケージごと)を**別々の`RUN`に分ける**。1つの`RUN`に`&&`で全部つなげない
    - `npm install -g`の後は`npm cache clean --force`、aptの後は`rm -rf /var/lib/apt/lists/*`を**同じ`RUN`の中で**実行する(別の`RUN`で消してもレイヤーは小さくならない)
    - `scripts/check-cf-containers.sh`は、`MAX_LAYER_MB`(既定800)を超えるレイヤーがあれば`NG`で止まる。この閾値を上げてNGを回避してはならない。超えた場合はレイヤーを分割する
    - イメージ全体の上限は`instance_type`のディスク容量(standard-1は8GB)。スクリプトが表示する`image size`を報告に必ず記載する
    - Codex CLIは今回の構成に必須のため削らない。サイズを減らすときは、CLIを外すのではなくレイヤーの分割とキャッシュの削除で対応する。Claude CLIは2026-10-17に外した(理由はNOTICE。Node 22以上が必要・この構成では使わない)。戻す場合はNode 22以上を先に用意すること
    - 本番ビルドの成否はGitHubの表示(後から書き換わる)で判断せず、`/cf-containers`の「最新ビルドのログを取得」で`Failed:`が無いことを確認する


41. **確かめていないことを確かめたように報告するな。原因を自分の変更以外に求める前に、まず自分の変更を疑え** — 2026-10-27、`/cf-containers`の作業で次の失敗を1日のうちに何度も繰り返し、ユーザーの時間を大きく奪った。
    - #2472で`src/views/cfContainers.ts`のtemplate literal内に`lines.join('\n')`と書き(ルール29違反)、ページのscriptが構文エラーで全ボタンが反応しなくなった。それなのに「関連テスト109件が通った」と報告した。そのテストは画面のscriptが実際に動くかを確かめていなかった。
    - 不具合の報告を受けた後も、`server.js`単体が起動することだけを根拠に「#2472が原因とは考えにくい」と答え、原因を自分の変更以外に求めた。実際の原因は自分が書いたその1行だった。
    - 「コンテナを起動し直せば入れる」とログで確かめないまま断言し、外れた。画面の「追加しました」が、古いコンテナの200応答を成功と誤認した誤表示だったことにも気づいていなかった。
    - マージ済みのPRのブランチへpushし(ルール34違反)、修正がmainに入らなかった。
    
    守ること:
    - **報告では「何を確かめたか」と「何を確かめていないか」を分けて書く。** テストが通ったと書くときは、そのテストが何を検証していて、何を検証していないかも書く。テストが通ったことを、テストが見ていない部分の正しさの根拠にしない。
    - **「〜すれば直る」「〜が原因ではない」と断言しない。** ログ・実行結果で確かめた事実だけを断言し、それ以外は推測だと明記する。
    - **不具合の報告を受けたら、最初に直前の自分の変更を疑う。** 「直前まで動いていた」なら、まずその間に入った自分の差分を1行ずつ見直す。自分の変更以外を原因として挙げるのは、その確認を終えてから。
    - **`src/views/*.ts`のページscriptを変更したら、push前に必ず実際の出力で構文を確かめる。** ページ関数(例: `getCfContainersPage()`)が返すHTMLから`<script>`を取り出し、`node --check`で全scriptが通ることを確認する。grepやソースの目視で済ませない。
    - **成功表示は、処理の結果を確かめてから出す。** HTTPステータスだけで成功と判断しない。応答の中身(例: `ok: true`)を確かめ、確かめられなければ失敗として表示する。
    - **pushの前に、そのブランチのPRがマージ済みでないかを毎回確認する**(ルール34)。


42. **作業の最初にAGENTS.mdを読め。重い検証・ビルドの前に、その差分に必要かを判断せよ。ソースからのビルドが3回失敗したら、ソースビルドしているパッケージ「すべて」にコンパイル済みの手段がないか確かめろ** — 2026-10-30、#2494(T3プロキシの修正)の検証で、次の失敗をした。
    - AGENTS.md「Dockerビルドの実行条件」(ユーザー指定、2026-10-18)は、Opus 5.5以上のモデルを使うとき以外はDockerビルドをしないと定めている。それを読まないまま、Sonnet 5.5のセッションでDockerデーモンを起動し、`scripts/check-cf-containers.sh`(内部でDockerビルドを行う)と小さなビルドを実行した。ルール39(ビルド必須)とAGENTS.md(ビルドの条件)が食い違う場面で、AGENTS.mdを確認しなかった。
    - 差分は`.cjs`2つと`COPY`1行だけなのに、Rubyのソースビルドを含むイメージ全体の検証に進み、Docker Hubの429とサンドボックスの403(`cache.ruby-lang.org`)で何度も止まった。触っていないステージのために時間を使った。
    - ソースからコンパイルしているパッケージに、コンパイル済みの手段があるか確かめなかった。ユーザーに指摘されて、はじめてRubyだけを調べた。指摘は、Rubyに限らず、パッケージのあるものすべてを確かめることだった。このときソースからのビルドは3回以上失敗しており、のちにユーザーが「3回失敗したら適用する」に緩めた。

    守ること:
    - **同じ作業で修正や検証が3回失敗したら、Sonnetでの作業を止め、ユーザーにOpus(5.5以上)へ戻すよう伝える(ユーザー指定、2026-10-30)。** 失敗に数えるのは、テストの失敗、ビルドや検証スクリプトの失敗(環境の制約による失敗も含む)、直っていないというユーザーの報告。モデルの切り替えはユーザーが行う。詳細はAGENTS.md「Sonnetで3回失敗したらOpusに戻す」。
    - **コンテナのビルドは、実行する前に、必ずユーザーに許可を求める。許可が出るまで実行しない(ユーザー指定、2026-10-30)。** Dockerビルドの条件を満たす場合も同じ。許可を求めるときは、何のためにビルドするか、差分がビルド工程に触れるか、所要時間の見込みを書く。
    - **作業の最初にAGENTS.mdを読む。** Dockerビルドの条件を満たさないモデルでは、Dockerデーモンの起動、`docker build`、内部でビルドを行うスクリプト(`scripts/check-cf-containers.sh`など)を実行しない。ルール39と食い違うときは、AGENTS.mdを優先し、フルビルドが未実施であることを報告に書く。
    - **検証の前に、この差分が何を変えるかを判断する。** 触っていないステージ(例: Rubyのコンパイル)のために、重い検証を走らせない。まず、ビルドを伴わない検証(単体テスト、実際のHTTPサーバーを立てたテスト、`node --check`、`wrangler deploy --dry-run`)で確かめられる範囲を確かめる。フルビルドが要る変更は、条件を満たす環境でやってもらうよう、ユーザーに頼む。
    - **ソースからビルドする前に、必ず次の調査をして、総合判断を報告に書く。省略しない(ユーザー指定、2026-10-30)。それでもビルドが必要なときだけ、最新のソースをビルドする。** (1) **版の差**: 本番D1の最新スナップショット(`SELECT id, created_at, image_commit, versions_json FROM cf_container_snapshots ORDER BY id DESC LIMIT 1;`)の版と、最新版を比べる。最新版の記録は`cf_container_package_release_status`にある。本番にこのテーブルが無いときは、そのSQLを利用者に示して作ってもらい、無い間は配布元で最新版を調べる。(2) **キャッシュの状況**: `SELECT m.build_created_on, m.build_status, (SELECT COUNT(*) FROM cf_container_build_steps s WHERE s.snapshot_key=m.snapshot_key AND s.state='cached') AS cached_steps FROM cf_container_build_measurements m ORDER BY m.build_created_on DESC LIMIT 8;`と、直近のビルドで時間のかかったステップ(`SELECT label, seconds FROM cf_container_build_steps WHERE snapshot_key=? ORDER BY seconds DESC LIMIT 8;`)。(3) **総合判断**: 版に差があるパッケージだけが、ソースビルドの対象になる。差の無いパッケージのために、ソースビルドを走らせない。判断の根拠(差・キャッシュ・所要時間)を報告に書く。
    - **2026-10-30の調査結果**: 最新スナップショット154番の版は、Tailscale 1.104.1、gh 2.103.0、Node 26.12.1、cloudflared 2026.10.1、Codex 0.164.0、jj 0.46.0、Ruby 4.0.9。最新版との差があるのは、Tailscale・gh・Node・cloudflared・Codexの5つで、jjとRubyは最新だった。本番ビルドの記録1,318ステップのうち`cached`は0件で、直近8回のビルドもすべて0件。2026-10-29のビルドでは、ソースビルドだけで約2,356秒(jj 875秒、Ruby 780秒、Tailscale 433秒、gh 267秒)かかっていた。「キャッシュが効いていない」のか「記録側が`cached`を拾えていない」のかは、確認できていない。本番D1に`cf_container_package_release_status`(マイグレーション0188)が無かった。
    - **(ルール44が優先する。公式のコンパイル済みのバイナリを使うのが既定で、ソースからのビルドは許可を得たものだけ。)** **ソースからのビルドが3回失敗したら、そこで初めて、ソースからビルドしているパッケージのすべてについて、コンパイル済みの手段の有無を確かめて報告に書く。**(ユーザー指定、2026-10-30。3回に達するまでは、事前の確認を必須にしない。)「3回」は、同じ作業の中で、ソースからのビルドが失敗した回数を数える。失敗の原因がサンドボックスの制約(429・403)でも、数える。対象は、Dockerfileで`configure`/`make`/`cargo install`/`go install`などを実行しているものすべてで、現在はRuby・Tailscale・gh・jjである。Rubyだけに限らない。確かめる手段は、公式のDockerイメージのタグ、配布元のバイナリ、aptの版である。変えるかどうかは、依頼されていなければ、提案にとどめる。
    - **3回失敗したときの調べ方は、公式の配布元より先に、このリポジトリの中を調べる。** 過去にビルドした成果物や、ビルドの記録が残っていることがある。(1) `git ls-files`で`.tar`/`.tgz`/`.deb`/`.zip`/`.gz`/`.xz`/`.whl`/`.wasm`/`.so`の成果物と、パッケージ名を含むファイル名を探す。(2) GitHubのリリースを一覧する。(3) `NOTICE.*`・`SPEC.*`・`EVAL.*`・`REPORT.*`をパッケージ名で検索する。(4) Dockerfileの履歴を`git log -S"<取得元のURL>" -- containers/demo/Dockerfile`でたどり、以前の入れ方を確かめる。見つけたものは、そのまま使えるか(ネイティブか、WASMか。版は同じか。コンテナで動くか)を確かめて、報告に書く。
    - **2026-10-30のリポジトリ内の調査結果**(調べた範囲だけ。「存在しない」とは言えない): (a) GitHubのリリースは0件だった。(b) `public/wasm/*.wasm`は、ブラウザ用にビルドしたWASMで、コンテナのネイティブなパッケージではない。(c) `public/tailscale-connect/1.102.3-3/`は、公式の`@tailscale/connect`(ブラウザ用のWASM)をnpmから取得して配置したもの。SPECに「独自のTailscaleソースビルドやDockerビルドは行っていない」とあり、コンテナの`tailscaled`としては使えない。(d) `NOTICE.cloudflare-workers-github-oauth-1.ruby-4.20260917.md`のRubyは、公式のWASMバイナリ(`@ruby/4.0-wasm-wasi`)をCDNから読み込むもので、コンテナのネイティブなRubyではない。(e) `SPEC.cloudflare-workers-github-oauth-1.Cursor-VM-Ruby.md`のRuby 4.0.7は、別のVM(`/home/box/.rbenv`)に`ruby-build`で入れたもので、リポジトリには成果物がなく、版も4.0.9と違う。(f) Dockerfileの履歴では、Rubyのソースビルドは[`f9bcdf70`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f9bcdf70)(2026-10-23)で入った。Tailscaleの`pkgs.tailscale.com`からの取得は[`970fa36f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/970fa36f)(2026-10-18)の時点にあり、のちにGoのソースビルドに変わった。**調べていない範囲**: 他のリポジトリ(`nekoserver/cf-container`など)、R2やレジストリ、削除済みの成果物の履歴、`gh`と`jj`。
    - **2026-10-30の実測**: Ruby 4.0.9の公式イメージ(`ruby:4.0.9-slim-trixie`など)は存在した。Ubuntu 26.04のaptのrubyは3.3で、4.0.9より古い。Tailscale・gh・jjは確かめていない。
    - **落とし穴ごとに、それを捕まえるテストを書く。** Dockerfileの`COPY`の入れ忘れのように、実行時にしか分からない失敗は、テストでソースの対応関係を検査する。
    - **サンドボックスの制約(Dockerビルドの条件を満たす環境で作業するときの参考)**: Docker Hubが429のときは`mirror.gcr.io/library/<名前>`から取得して`docker.io/library/<名前>`のタグを付ける。Dockerデーモンが無ければ、古い`/var/run/docker.sock`を消して`dockerd`を起動する。拒否されたホストは`curl "$HTTPS_PROXY/__agentproxy/status"`で分かる。許可ドメインの設定は、動いているセッションには反映されないことがあった(理由は未確認)。
    - **思い出せないことを前提に、実行前にこの項目とAGENTS.mdを読む。**


43. **テストファーストを常識にしろ。外部のツール(T3・Codex・Tailscaleなど)に頼る挙動は「契約テスト」に書き、版を上げる前にテストを先に直せ** — 2026-10-28〜31の3日間、T3のPWAの引き継ぎで、T3の実際の挙動を確かめないまま推測で直しては外す、を繰り返した(例: 認証失敗時に401が返ると決めつけたが、実際は200の`authenticated:false`だった。ペアリングの資格情報の期限が5分だと知らずに、期限切れのトークンを使わせた。引き継ぎを有効にする設定ファイルを作る処理が無く、本番ではずっと無効だった)。どれも、先にテストを書いていれば、実装の前に気づけた。ユーザー指定(2026-10-31): 「テストファーストじゃないと、今後のバージョンアップ時の仕様変更にも対処不能だから、常識化してくれ」。

    守ること:
    - **コードを変える前に、新しい仕様を表すテストを書き、そのテストが失敗することを確かめてから実装する。** 仕様を変えるときは、古い仕様のテストを先に新しい仕様へ書き換える(古いテストを残したまま実装を合わせない)。
    - **外部のツールの挙動に頼るときは、その挙動を、根拠(ツールのソースの箇所や公式の文書)と一緒に、契約テストに書く。** 例: `src/cf-containers-t3-contract.test.ts`(T3)。契約テストは、Dockerfileで固定した版と、契約を確かめた版が同じであることも検査する。
    - **外部のツールの版を上げるときは、テストを先に直す。** 新しい版のソースや文書で、契約の各項目を確かめ直し、契約テストの版を上げてから、Dockerfileの版を上げる。確かめないまま版だけ上げると、契約テストが失敗する。版を上げるときは、そのツールが要求する実行環境(例: Goの版)も確かめる(`src/cf-containers-go-toolchain.test.ts`)。
    - **推測で直さない。** 外部のツールの挙動は、ソースか、実際の応答か、ログで確かめてから、テストに書く。確かめられないものは、テストにも報告にも「未確認」と書く。

44. **公式のコンパイル済みのバイナリがあるものは、それを使うのが既定。ソースからのビルドは、理由を書いて許可を得たものだけに限る。ドキュメントだけの変更で、コンテナを作り直さない** — 2026-10-31、gh・jjを毎回ソースからコンパイルし、本番のビルドで約19分(jj 875秒・gh 267秒)を使い続けていた。公式のGitHubリリースにコンパイル済みのバイナリがあったのに、2026-10-21に「エージェントのサンドボックスから配布元に届かない」という、本番には関係のない理由でソースビルドへ変えていた(#2508で戻した)。また、ドキュメントだけのPRをマージしても、毎回コンテナのイメージを作り直していた。ユーザー指定(2026-10-31): 指示されなくても毎回適用すること。
    この方針は、Dockerビルドの前提処理として[`SPEC.cloudflare-workers-github-oauth-1.20261031.docker-build-preconditions.md`](SPEC.cloudflare-workers-github-oauth-1.20261031.docker-build-preconditions.md)にまとめてある。テスト(`src/cf-containers-source-build-allowlist.test.ts`)と、push前の自動検査(`scripts/claude-push-guard.js`)で強制する。

    守ること(指示されなくても、毎回適用する):
    - **新しいパッケージを入れるとき、版を上げるとき、Dockerfileを変えるときは、まず公式のコンパイル済みの手段を探す。** 探す順は、配布元のリリース(GitHub Releasesなど)、公式のパッケージ配布(例: pkgs.tailscale.com)、aptの版、公式のDockerイメージ。見つかれば、それを使う。取得物は配布元の値か、取得物から計算した値のsha256で照合する。
    - **ソースからのビルドを足す・戻すのは、ユーザーの許可を得てからにする。** 許可を得たら、`src/cf-containers-source-build-allowlist.test.ts`の`ALLOWED_SOURCE_BUILDS`に、ステージ名と「コンパイル済みを使えない理由」を書く。表に無いソースビルドは、このテストが失敗させる。理由が解消したら、公式のバイナリへ切り替え、表から消す(残っていてもテストが失敗する)。
    - **エージェントのサンドボックスから配布元に届かないことは、ソースビルドの理由にならない。** 本番のビルド環境と、サンドボックスは別物である。サンドボックスで確かめられないときは、確かめていないことを報告に書き、本番のビルドで確かめる。
    - **ソースからビルドしたら、パッケージ(インストール先・成果物)まで作り、ビルド済みのものが読み込めること(`--version`などで動くこと)を確かめた時点で、ソースツリーとビルドのキャッシュを捨てる(ユーザー指定、2026-10-31)。** Dockerfileでは、同じ`RUN`の中で「インストール → 動作の確認 → 削除(例: `rm -rf /tmp/<名前>-src`・`go clean -modcache -cache`)」まで行う。許可したソースビルドごとに、`src/cf-containers-source-build-allowlist.test.ts`の`CLEANUP`に確認と削除の手順を書く(無ければテストが失敗する)。エージェントの手元(スクラッチパッドなど)で取得・展開したソースツリーや配布物の展開先も、成果物の確認が済んだら消す。ビルド済みのパッケージのキャッシュ(保存先は未決定)を導入したときは、キャッシュから読み込めることを確かめてから、ソースツリーを消す。
    - **ソースを捨てる前に、キャッシュの効果を測って、ビルドのたびにD1に記録する(ユーザー指定、2026-10-31)。** ソースからのコンパイル時間、パッケージ(キャッシュ)からのインストール時間、ソースアーカイブとパッケージのバイト数を、Dockerfileが`CACHE_EFFECT`の行としてビルドログに出し、ビルドログの取り込みが`cf_container_build_cache_effects`(マイグレーション0191)に保存する。新しくソースビルドを許可したときは、この行も必ず出す(無ければ`src/cf-containers-source-build-allowlist.test.ts`が失敗する)。
    - **ドキュメント(`*.md`)だけの変更で、本番のビルドを走らせない。** Workers Buildsの「Build watch paths」(Cloudflareのダッシュボード → Workers → Settings → Builds)で`*.md`を除外する。これはダッシュボードの設定で、エージェントからは変えられない。設定されているかを確かめられないときは、ドキュメントだけの変更を、コードの変更と同じPRにまとめる。ドキュメントだけのPRを、単独で立て続けにマージさせない。
45. **`ORIGIN_HMAC_SECRET`(旧名`HMAC_SECRET`)は影響範囲が広いので、部分変更をするな。全体を見通せるまでは調査だけを行い、一括で修正できるところまで見えてから実施する**(ユーザー指定、2026-11-04) — この鍵はWorker、コンテナ、`lib`、`cf-container`、`rust-worker-sqlx-d1`などのリポジトリをまたいで使われており、一部だけを変えると署名の検証が食い違う。
    - **対象の変更**: 鍵の値の変更・再発行、配布経路(`demoContainer.ts`の`envVars`、`ALLOWED_SECRET_NAMES`、`entrypoint.sh`、`/etc/lib-hmac.env`)の変更、署名と検証の処理の変更、旧名`HMAC_SECRET`の廃止。
    - **扱い**: この鍵の改修は、変更の大きさに関わらずすべて大規模改修とする(ルール46)。鍵の解決順序には`ORIGIN_HMAC_SECRET`→`HMAC_SECRET`→保存値や`REDMINE_HMAC_SECRET`というフォールバックがある。
    - **実施の条件**: (1) 鍵を使う全サービスと全リポジトリの一覧がそろっている、(2) 各所の現在の値が一致しているかを確かめた、(3) 全箇所を切り替える順序と、切り戻しの手順が決まっている、(4) 影響するテストの一覧がある、(5) 今後増えるコンテナにも同じ手順で適用できる。5つがそろったら、[`SUGGEST.cloudflare-workers-github-oauth-1.20261104.md`](SUGGEST.cloudflare-workers-github-oauth-1.20261104.md)に記録し、ユーザーの承認を得てから一括で実施する。
    - **保留中に行ってよいこと**: 読み取りだけの調査と、一覧の記録。この鍵の扱いを変えない、ほかのトークンの修正。
    - **新しいコンテナやWorkerを追加するとき**: この鍵を使うなら、SUGGESTの台帳に追記する。一覧が古くならないようにするためである。
    - ユーザーが明示的に指示した場合は、この限りではない。
46. **テストの不合格からフォールバックの適用までを確認しなければならない変更は、すべて大規模改修として扱え**(ユーザー指定、2026-11-04) — 変更の行数やファイル数では判断しない。1行の修正でも、失敗時に別の値・別の経路へ切り替わる動作に関わるなら大規模改修である。
    - **確認すること**: 通常の経路だけでなく、テストで失敗を起こし、不合格になることを確かめ、フォールバックが適用されるところまで確かめる。
    - **報告に書くこと**: 大規模改修に当たるかどうかと、確かめたフォールバックの経路。確かめていない経路があれば、それも書く。
    - **該当する例**: `ORIGIN_HMAC_SECRET`の解決順序(ルール45)、`setup-network.py`の`merge_settings`、`refresh-lib-tunnels`の環境変数と保存値の優先順位。
47. **プルリクエストには、コンテナの再ビルドと再起動が必要かどうかを毎回書け**(ユーザー指定、2026-11-07) — PRを読んだ人が、マージ後にコンテナのイメージを作り直すべきか、起動中のコンテナを再起動すべきかを、差分を読まずに判断できるようにする。2026-11-07、Worker側だけの変更のPRで、再ビルドが要るかを聞かれ、さらに前回の作業の報告にあった「イメージに未反映」を確かめずに引き継いで誤答した(実際は本番のイメージに反映済みだった)。
    - **書く場所**: PR本文に`## コンテナ`の節を設け、次の2行を必ず書く。ドキュメントだけのPRでも省略しない。`.github/PULL_REQUEST_TEMPLATE.md`に同じ欄がある。
      - `再ビルド: 必要` か `再ビルド: 不要`、と根拠
      - `再起動: 必要` か `再起動: 不要`、と根拠
    - **再ビルドの判断**: 差分が`containers/**`(イメージのビルドの文脈は`containers/demo/`で、DockerfileはここのファイルだけをCOPYする)、`src/containers/**`、`wrangler.toml`の`[[containers]]`に触れていれば必要。`src/`(`src/containers/`を除く)と`public/`(Workerの静的アセット。`wrangler.toml`の`assets`)だけなら不要で、Workerのデプロイで反映される。
    - **前の変更が本番のイメージに入っているかの判断**: 本番D1の`SELECT id, created_at, image_commit FROM cf_container_snapshots ORDER BY id DESC LIMIT 1;`の`image_commit`を取り、`git merge-base --is-ancestor <確かめたいコミット> <image_commit>`で確かめる。報告や文書の「未反映」をそのまま引き継がない。
    - **再起動の判断**: イメージが同じでも、コンテナが起動時に読む値を変えたら再起動が要る。例: Workerがコンテナへ渡す環境変数(`demoContainer.ts`の`envVars`、`ALLOWED_SECRET_NAMES`)、secretの値(`TAILSCALE_AUTHKEY`、`ORIGIN_HMAC_SECRET`など)。再ビルドが必要なら、新しいイメージで動かすための再起動も必要と書く。Worker側だけの変更なら不要。
    - **確かめられないときは「未確認」と書く。** 推測で「不要」と書かない(ルール41)。
    - コンテナのビルドを実行するかどうかは、別にルール42とAGENTS.md「Dockerビルドの実行条件」に従う。このルールは、PRに要否を書くことだけを定める。

---

## 自動アップロード対象の区別

自動アップロードしてよいものとよくないものを混同しないこと。
「コピーできるようにして」「ダウンロードできるようにして」と頼まれても、後者を前者の置き場所に流用しない。

### 自動アップロードしてよいもの

依頼されたコード変更の動作証明だけ。

- スクリーンショット、画面録画、テストログのうち、その変更が動いたことを示すもの
- 置き場所は `/opt/cursor/artifacts`
- PR に載せるなら `img` / `video` だけ

### 自動アップロードしてはいけないもの

チャットで渡せば足りる生成物。リポジトリにも成果物ディレクトリにも置かない。

- D1 に貼る関数カタログ SQL（`ts_function_catalog` 更新SQLを含む）
- コピー用・ダウンロード用の一時ファイル
- 「コピーできるようにして」と頼まれた本文
- リポジトリに残す必要のない生成物

これらはチャットのコードブロックで提示する。コードブロック右上のコピーで足りる。
ユーザーが明示的にリポジトリへ追加するよう頼んだ場合だけ例外とする。

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

### 個別トピックの索引

特定トピックについて過去のNOTICEファイルを探す場合、以下を参照する
(このリストは網羅ではなく、後から探しやすいよう主要なものを追記していく)。

- D1への問い合わせ時のクエリ最適化(N+1問題・バインド上限チャンク分割):
  [`NOTICE.cloudflare-workers-github-oauth-1.20260806.md`](NOTICE.cloudflare-workers-github-oauth-1.20260806.md)
- Rust/WASM実装(wasm32ビルド制約・ブラウザ/サーバー共用・vitestとの相性・CSP・ast-grep):
  [`NOTICE.cloudflare-workers-github-oauth-1.rust-WASM.md`](NOTICE.cloudflare-workers-github-oauth-1.rust-WASM.md)
- PWA(ホーム画面追加・standalone表示・アドレスバー表示不具合):
  [`NOTICE.cloudflare-workers-github-oauth-1.pwa.md`](NOTICE.cloudflare-workers-github-oauth-1.pwa.md)
- T3 CodeのログインとPWA化(ペアリングの契約・Invalid/Timed outの違い・X-Forwarded-Host・iframeの中のクッキー・PWAはクッキーを共有しない・自動承認):
  [`NOTICE.cloudflare-workers-github-oauth-1.20261031.md`](NOTICE.cloudflare-workers-github-oauth-1.20261031.md)
  [`SPEC.cloudflare-workers-github-oauth-1.T3-PWA.20261031.md`](SPEC.cloudflare-workers-github-oauth-1.T3-PWA.20261031.md)
- gitのshallow clone(コミット履歴を根拠にした調査が壊れる・`git fetch --unshallow`での対処):
  [`NOTICE.cloudflare-workers-github-oauth-1.20260906.md`](NOTICE.cloudflare-workers-github-oauth-1.20260906.md)
- GitHub webhook → Slack/外部Worker(Altワーカー)通知パイプライン(経路A/B/Cの区別・write-onlyデータストア事故・Slack app_mentionのbot判定):
  [`NOTICE.cloudflare-workers-github-oauth-1.github-webhook-slack.md`](NOTICE.cloudflare-workers-github-oauth-1.github-webhook-slack.md)
- /cursor-agent（起動・チャンク結合・キャッシュ・応答/過去検索。次工程はAIチャット入力窓とダイナミックワーカー。診断エラー `no such table: cursor_agent_answer_cache` は `SPEC.cursor-agent.md` に必載）:
  [`SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md`](SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md)
  [`SPEC.cursor-agent.md`](SPEC.cursor-agent.md)
  [`NOTICE.cloudflare-workers-github-oauth-1.20260914.md`](NOTICE.cloudflare-workers-github-oauth-1.20260914.md)
  [`SPEC.cloudflare-workers-github-oauth-1.20260914.md`](SPEC.cloudflare-workers-github-oauth-1.20260914.md)
  [`EVAL.cloudflare-workers-github-oauth-1.cursor-agent.md`](EVAL.cloudflare-workers-github-oauth-1.cursor-agent.md)
- /cf-containers(Cloudflare Containers)・Workers Builds(PRビルドはイメージをビルドしない・イメージ失敗でもWorkerだけ出る・結果表示の上書き・Builds APIの権限・トークンの使い分け・サンドボックスでのフルビルド):
  [`NOTICE.cloudflare-workers-github-oauth-1.20261017.md`](NOTICE.cloudflare-workers-github-oauth-1.20261017.md)
- `/muse-status`のNix一覧、Museとの問い合わせの進め方、本番反映の承認、D1`agent-inquiries`:
  [`NOTICE.cloudflare-workers-github-oauth-1.20261107.md`](NOTICE.cloudflare-workers-github-oauth-1.20261107.md)
  [`NOTICE.cloudflare-workers-github-oauth-1.muse-agent.20261107.md`](NOTICE.cloudflare-workers-github-oauth-1.muse-agent.20261107.md)
  [`NOTICE.cloudflare-workers-github-oauth-1.agent-inquiries.20261107.md`](NOTICE.cloudflare-workers-github-oauth-1.agent-inquiries.20261107.md)
- demoコンテナのイメージをdigestで固定した経緯(Workers BuildsのDockerビルドが`runc ... mounting "proc" ... operation not permitted`で落ちる)と、コンテナを変えるときの手順(`image.lock.json`):
  [`NOTICE.cloudflare-workers-github-oauth-1.20261111.md`](NOTICE.cloudflare-workers-github-oauth-1.20261111.md)
- demoコンテナを`@cloudflare/containers`(非推奨)からDurable Object Container API(`this.ctx.container`)へ移した経緯、旧クラスが裏でしていたこと(ポートの待ち・インターネット許可・アラームで起こし続けるループ)、停止の記録とスナップショットの制約:
  [`SPEC.cloudflare-workers-github-oauth-1.20261111.container-api-migration.md`](SPEC.cloudflare-workers-github-oauth-1.20261111.container-api-migration.md)
  [`NOTICE.cloudflare-workers-github-oauth-1.20261111.md`](NOTICE.cloudflare-workers-github-oauth-1.20261111.md)の後半
- Worker内WASM(`main-worker-muse`)のMuseで、推論に1分以上かかると返事が届かない(送信の無いDERP中継を約1分で閉じる)・`/health`で通り道を保つ対処・Durable Objectで待っても直らない理由・本番ログ(Workers Observability)の調べ方:
  [`NOTICE.cloudflare-workers-github-oauth-1.20261112.md`](NOTICE.cloudflare-workers-github-oauth-1.20261112.md)
- Worker由来のTailscaleノード(`main-worker-muse`・`muse-monitor`)の所在と状態の保存先、ブラウザをノードにすると毎回ログインが要る理由、Museへの要望の2つの仕組み(`bridge_jobs`は手動・`MuseAgentJobs`は自動)と`failed`の理由:
  [`NOTICE.cloudflare-workers-github-oauth-1.20261110.md`](NOTICE.cloudflare-workers-github-oauth-1.20261110.md)
- `/muse-status`のTailscale WASM経由の取得(`@tailscale/connect`の`fetch`の制約・ルートのCSP・`/health`の性質・このコンテナでの検証の注意・再ビルドの判断):
  [`NOTICE.cloudflare-workers-github-oauth-1.muse-status-wasm.20261107.md`](NOTICE.cloudflare-workers-github-oauth-1.muse-status-wasm.20261107.md)
- コミットとファイルの関連付け(`commit_file_changes`テーブル。「どのコミットがどのファイルを変更したか」の汎用記録。push webhook経由の自動蓄積が主経路、dynamicneko `/api/tree-view/commit-files`からの"ついで書き込み"による段階的バックフィルが補助経路。関連する既存の`ai_summary_files`はPR/push単位でしかファイルを持たず個別コミットに紐付かない点に注意)。この関係の実装・調査をする際は、必ず先にこのSPECを読むこと:
  [`cloudflare-workers-github-oauth-1` PR #2371](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/2371)（`commit_file_changes`新設・push webhook自動蓄積・`POST /api/commit-file-latest-external`）
  [`cloudflare-workers-github-oauth-1` PR #2372](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/2372)（書き込み用`POST /api/commit-file-changes-external`）
  dynamicneko [PR #332](https://github.com/nekoserver/dynamicneko/pull/332)（`SPEC.dynamicneko.20261015.md`・`EVAL.dynamicneko.20261015.commit-file-changes-backfill.md`。流用判断の経緯含む設計と評価）

---

## コード変更前の故障想定チェックリスト（必須）

コードを書き始める前に、以下の4項目を明文化してから作業に入ること。作業中も各ステップで参照し、完了時に満たされていることを確認する。

### 1. 故障シナリオの列挙

「どういう場合に動かなくなるか」を事前に列挙する。

- 入力データが想定と異なる場合（型、NULL、空配列、カラム名の不一致など）
- 外部依存の挙動が想定と異なる場合（SQLiteのPRAGMAがJOINカラムを返さない等）
- クライアント・サーバー間のデータ形式の不整合（APIが返すカラム名とクライアントがアクセスするキー名のずれ）
- デプロイバージョンの差異（手元のコードとデプロイ済みコードが異なる可能性）

### 2. テスト設計

各故障シナリオに対して「失敗を検出できるテスト」を書く。

- **自明なこと（言語仕様・DB仕様から確定する挙動）はテストしない** — テストすべきは「自分のコードの組み合わせで壊れうる箇所」
- **正常系テスト**: 期待する出力が得られることを保証する。モックが正しく返るかではなく、**実際のデータフローの末端で期待値が得られるか**を検証する
- **異常系テスト**: 故障シナリオごとに、エラーが適切に処理されるか、またはユーザーに通知されるかを検証する
- テストが通るだけのモックを作るのは禁止。本番環境の挙動を再現するモックを作る

### 3. 予兆の捕捉方法

故障が起きる前に異常を検知する手段を設計する。

- APIレスポンスの`columns`と`rows`の整合性チェック（カラム数の不一致はログに記録する等）
- エラーレスポンスの具体的な理由を呼び出し元に伝える（「取得に失敗しました」だけでは原因が追えない）
- catch で握りつぶす場合はルール8に従う

### 4. 対処方針の事前決定

異常検知時にどうするかを事前に決める。

- **自動回復可能**: フォールバック処理を実装する（例: AI_MODELフォールバック）
- **自動回復不能・軽微**: エラー詳細をレスポンスに含め、ユーザーが原因を判断できるようにする
- **自動回復不能・重大**: 処理を停止し、管理者に通知する手段を用意する

### 運用

- 上記4項目は**コードを書く前にテキストで書き出す**（コミットメッセージ、PR説明文、またはSPECファイルに記載）
- 作業途中で新たな故障シナリオに気づいたら即座に追記し、対応するテストを追加する
- テストが通らない状態で次の作業に進むことは禁止

---

## コミット前の新関数検出（必須）

`git commit` を実行する前に、このリポジトリの TypeScript ソースに新しく追加・変更された関数を
`ts_function_catalog`（行番号・呼び出し元含む）へ反映するためのステップを必ず実行すること。

### 実行手順

1. **変更ファイルの特定**
   ```bash
   git diff --name-only HEAD | grep '\.ts$'
   git diff --name-only --cached | grep '\.ts$'
   ```
   変更された `.ts` ファイルを列挙する（テストファイル `*.test.ts` は除外）。

2. **インデクサースクリプトを実行して SQL を生成**
   変更されたファイルを引数に渡してスクリプトを実行する:
   ```bash
   npx tsx scripts/index-functions.ts <changed-file1.ts> [<changed-file2.ts> ...]
   ```
   引数なしにすると `src/` 以下の全 `.ts` ファイルを対象にする（初回一括投入時のみ）。

   スクリプトは以下の SQL を標準出力に出力する:
   - **既存関数**: `start_line` / `end_line` / `is_exported` / `is_async` を UPDATE（`purpose` は保持）
   - **新規関数**: `purpose='(自動検出)'` でフォールバック INSERT
   - **呼び出し元**: `ts_function_callers` テーブルを DELETE + INSERT で最新化

3. **新規関数の purpose を日本語に修正**
   出力 SQL に `purpose='(自動検出)'` の行が含まれる場合は、コードの内容から
   日本語の `purpose`（1文・体言止め）を生成して SQL 内で修正してからユーザーに提示する。

4. **SQL をユーザーに提示して D1 で実行**
   修正後の SQL をコードブロックで提示する（`--` コメント禁止）。
   ユーザーが D1 コンソールにそのまま貼り付けて実行できる形式にすること。
   この SQL は自動アップロード対象外である。`/opt/cursor/artifacts` にもリポジトリにも置かず、
   ダウンロード用HTMLやGit上のファイルで代用しないこと。

5. **新関数も変更もなければスキップ**
   変更ファイルに関数の追加・変更が一切なければこのステップはスキップしてよい。
   その場合も「新関数なし、スキップします」とひと言報告すること。

### 注意事項

- スクリプトはトップレベル関数（インデントなし）のみを検出する。クラスメソッドは除外される。
- 行番号はコミットのたびに変わりうるため、変更があったファイルは毎回スクリプトにかけること。
- 呼び出し元の検出はテキスト検索（`functionName(`）のため、同名の変数と誤検知する場合がある。
  カタログ用途のため誤検知は許容範囲内とする。
- このステップは `npx vitest run` の後・`git commit` の前に実行する。

### `/function-changelog` の集計データを増やす方法

`/function-changelog` ページ（関数変更ログ）および📈円グラフは `ts_function_activity_log` テーブルのデータを表示する。
このテーブルはインデクサースクリプトを実行したファイル分のデータしか入らないため、過去のファイルは手動で追加が必要。

- **特定ファイルだけ追加**: `npx tsx scripts/index-functions.ts src/views/foo.ts src/index.ts`
- **全ファイル一括（大量SQL生成注意）**: `npx tsx scripts/index-functions.ts`

全件実行すると SQL が大量になるため、D1 コンソールへの貼り付けはファイルを絞って少しずつ実行すること。

---

## 崩れない罫線（区切り線・表罫線）の書き方

Markdown やチャットUIでは、等幅フォントにならない／自動折り返しが入る／Unicode 罫線が環境差で崩れる、
といった理由で「見た目の罫線」が壊れやすい。以下のルールで書くこと。

### 区切り線

- 文章の区切りは **Markdown の水平線** を使う（`---` を単独行に置く）

例:

```markdown
---
```

### 表

- 可能なら **Markdown テーブル**（`|` と `---`）を使う。見た目の整列（スペースでの列揃え）は不要
- 「ASCII 罫線表（`+---+` / `|`）」を使う場合は **必ず fenced code block** に入れる（` ```text`）
- 罫線文字は **ASCII のみ**（`-` `|` `+`）。Unicode の罫線（`─` `│` `┼` 等）や全角記号は使わない
- 折り返しを避けるため、1行は短め（目安 80 文字以下）にする

例（Markdown テーブル）:

```markdown
| 項目 | 値 |
|---|---|
| Worker名 | `cloudflare-workers-github-oauth-1` |
```

例（ASCII 罫線表。必ず `text` の code block）:

```text
+-----------+------------------------------+
| key       | value                        |
+-----------+------------------------------+
| worker    | cloudflare-workers-github... |
| callback  | /github/callback             |
+-----------+------------------------------+
```
