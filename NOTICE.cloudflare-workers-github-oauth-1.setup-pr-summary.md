# NOTICE.cloudflare-workers-github-oauth-1.setup-pr-summary.md

**対象**: `POST /webhook/github`によるPRイベント受信→AIによる日本語要約生成→Slack通知→D1保存(`ai_summary_log`/`ai_summary_reviews`)→Slackモーダル表示という「PR要約」機能一式。コミットログ(`git log`)を追って、この機能がどの段階を経て今の形になったか、各段階で何が新たに可能になったかを時系列でまとめる。

---

## 全体の流れ(俯瞰)

```
1. OAuthコールバック確立(前提)
2. GitHub App Webhook受信基盤の構築(installation権限)
3. Cloudflare連携判定をGitHub App経由に統一
4. pull_requestイベントでAI要約→Slack通知(機能の初版)
5. 要約にD1ログ(ai_summary_log)を追加、通算番号採番
6. ステータスページへのテーブル登録漏れ修正
7. diff取得ヘッダー不備の修正
8. Slack通知成功判定バグの修正
9. ai_summary_logの拡張 + ai_summary_reviews新設 + 詳細/フィードバックAPI
10. diffなしでも要約するように修正(NULL多発の一因を除去)
11. 失敗時のエラー情報をsummaryに記録(可視化)
12. ロジックをaiSummary.tsに抽出しユニットテスト追加
13. 自動診断結果をai_summary_reviewsに記録(auto-diagnosis)
14. runSummaryPipelineへ統合し「握りつぶし」を根絶
15. NOTICE化(AI_MODEL設定・NULL問題の顛末を記録)
16. Slack表示の改善(ブロッククォート・詳細リンク)
17. Slack Block Kit化 + モーダル表示(生JSON表示問題の解消)
18. モーダルタイトルの微調整
```

各段階の詳細を以下に記す。

---

## 1. 前提: OAuthコールバックの確立

**コミット**: [`09943d7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/09943d7) (2026-03-07)
`Fix: OAuth callback route to match GitHub App setting (/github/callback)`

**やったこと**: OAuthコールバックのルートパスをGitHub App側の設定と一致させた。

**新たに可能になったこと**: GitHub OAuthログインが正常に完了するようになった。これ自体はPR要約機能の前提条件(GitHub Appとしてユーザー・リポジトリの認証基盤が動く状態)であり、後続のWebhook基盤構築の土台になった。

---

## 2. GitHub App Webhook受信基盤の構築

**コミット**: [`688c22b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/688c22b) (2026-03-16)
`feat: GitHub App Webhook受信とD1権限保存、セキュリティSlack通知を実装`

**やったこと**:
- `POST /webhook/github`を新設し、GitHub Appの`installation`イベントを受信してD1に権限を保存
- HMAC-SHA256署名検証ユーティリティ(`src/utils/githubWebhook.ts`)を実装
- D1 `installation_permissions`テーブルを追加(migration 0004)
- `/repositories`・`/api/repo-permissions`をD1優先・GitHub APIフォールバック方式に変更
- ログイン失敗・JWT検証失敗・Appインストール変更時のSlack通知を追加

**新たに可能になったこと**: `/webhook/github`という**単一のエンドポイントでGitHub Appからの複数イベント種別を安全に(署名検証付きで)受信できる基盤**ができた。この基盤があったからこそ、後の`pull_request`イベント処理(PR要約)を同じハンドラに追加するだけで実現できた。また、リポジトリ一覧のインストール権限データがGitHub API呼び出しなしで高速に取得できるようになった。

---

## 3. Cloudflare連携判定をGitHub App経由に統一

**コミット**: [`1577178`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1577178) (2026-03-16)
`refactor: Cloudflare連携判定をGitHub App installations経由に変更`

**やったこと**:
- Cloudflare API直接呼び出し方式を廃止し、GitHub App installationsの`app_slug`に`"cloudflare"`を含むかどうかで連携判定
- `CLOUDFLARE_API_TOKEN`・`CLOUDFLARE_ACCOUNT_ID`が不要になった
- `src/utils/cloudflare.ts`を削除

**新たに可能になったこと**: 外部APIトークンへの依存を減らし、**2節で構築したGitHub App Webhook基盤(installation_permissions)を他の判定ロジックでも再利用する**パターンが確立した。PR要約機能自体には直接関係しないが、「webhook経由で受信したD1データを判定ロジックの正とする」という設計方針がこの時点で固まった。

---

## 4. pull_requestイベントでAI要約 → Slack通知(機能の初版)

**コミット**: [`47480eb`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/47480eb) (2026-03-21)
`feat: PRイベントのWebhook受信時にWorkers AIで要約してSlack通知`

**やったこと**:
- 既存の`/webhook/github`ハンドラに`pull_request`イベント(`opened`/`synchronize`)の分岐処理を追加
- PRのdiffを取得し、Workers AI(`llama-3.1-8b-instruct`)で日本語要約を生成
- 要約結果をSlackに投稿
- `types.ts`に`GitHubWebhookPullRequestPayload`型、`AI`/`GITHUB_TOKEN`バインディングを追加
- `wrangler.toml`に`[ai]`バインディングを追加

**新たに可能になったこと**: **PR要約機能そのものがここで初めて動くようになった**。GitHubにPRが作成・更新されると、diffがAIによって日本語で要約され、Slackに自動投稿される状態が実現した(この時点ではD1へのログ保存はまだ無い)。

---

## 5. D1ログ追加・通算番号採番

**コミット**: [`55cd1e3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/55cd1e3) (2026-03-21)
`feat: AI要約の通算番号・固有IDをSlack投稿に追加し、D1にログ記録`

**やったこと**:
- migration 0012で`ai_summary_log`テーブルを新設(`request_id`、`daily_seq`、イベント情報、要約、Slack通知結果を記録)
- 本日の通算番号をD1から算出し、`crypto.randomUUID()`で固有IDを生成、Slack投稿フッターに表示

**新たに可能になったこと**: 要約結果がSlackに投稿されるだけでなく**D1に永続化される**ようになった。これにより後から要約履歴を検索・集計できるようになり(cf-authの`/wspace`ページが後にこのテーブルを読むことになる)、Slack投稿ごとに一意なIDで参照できるようになった。

---

## 6. ステータスページへのテーブル登録漏れ修正

**コミット**: [`bda8d2d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/bda8d2d) (2026-03-21)
`fix: ai_summary_log テーブルを STATUS_TABLE_DEFINITIONS と STATUS_MIGRATION_SQL に登録`

**やったこと**: migration 0012(`ai_summary_log`)が`/status`ページの「テーブル別マイグレーション状況」に表示されない不具合を修正。

**新たに可能になったこと**: `/status`ページで`ai_summary_log`テーブルの存在・行数を目視確認できるようになった(CLAUDE.mdルール23の「OK/NG/未作成」3状態表示の対象に組み込まれた)。

---

## 7. diff取得ヘッダー不備の修正

**コミット**: [`1b055b3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1b055b3) (2026-03-21)
`fix: PR diff取得にAccept/User-Agentヘッダーを追加し、AI要約スキップ時のログを強化`

**やったこと**: `diff_url`へのリクエストに`Accept: application/vnd.github.v3.diff`と`User-Agent`ヘッダーを追加(欠けていると403/406の可能性)。`GITHUB_TOKEN`未設定・diff取得失敗・AIバインディング欠落時にwarnログを追加。

**新たに可能になったこと**: diff取得がGitHub APIに正しく弾かれずに成功するようになった。また、失敗時に**原因をログから特定できる**ようになった(この時点ではまだD1への記録ではなくログのみ)。

---

## 8. Slack通知成功判定バグの修正

**コミット**: [`4aba1a3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4aba1a3) (2026-03-22)
`fix: PR webhook の Slack 通知が常に成功扱いになるバグと環境変数不足時のサイレント失敗を修正`

**やったこと**: `postSlackMessage()`がエラー時に`throw`せず`{ok: false}`を返す仕様なのに戻り値を検査せず`slackNotified = true`にしていたバグを修正。`SLACK_OAUTH_TOKEN`/`SLACK_CHANNEL_ID`未設定時の警告ログを追加。

**新たに可能になったこと**: Slack通知が実際に失敗しているのに成功したとD1に記録される、という**サイレント障害を検知できる**ようになった(CLAUDE.mdルール8の「catchで握りつぶすなら3つの義務」の実例)。

---

## 9. ai_summary_logの拡張 + ai_summary_reviews新設 + 詳細/フィードバックAPI

**コミット**: [`d9cc398`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d9cc398) (2026-03-22)
`feat: ai_summary_log拡張(resolved/view_count/tags)とai_summary_reviewsテーブル・API追加`

**やったこと**:
- migration 0015: `ai_summary_log`に`resolved`, `resolved_at`, `resolution_note`, `view_count`, `parent_id`, `tags`カラムを追加
- migration 0016: `ai_summary_reviews`テーブルを新設(評価者種別・評価AIモデル名・コメント対応)
- `GET /api/ai-summary/:id`(要約詳細取得+閲覧回数インクリメント)、`POST /api/ai-summary/:id/feedback`(good/badレビュー登録)、`POST /api/ai-summary/:id/resolve`(解決フラグ更新)を追加

**新たに可能になったこと**: 要約ごとに**「解決済みか」「何回見られたか」「タグ付け」「人間またはAIによる評価」**を記録・参照できるようになった。詳細ページ・フィードバックAPIが整備され、後のSlackモーダル(17節)やcf-auth側の`/wspace`フィードの土台になった。

---

## 10. diffなしでも要約するように修正

**コミット**: [`608e6d7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/608e6d7) (2026-03-24)
`fix: diffがなくてもAI要約を生成するように修正`

**やったこと**: `trimmedDiff`が空の場合にAI呼び出し自体がスキップされ全レコードの`summary`がNULLになっていたバグを修正。diff取得不可時もPRタイトル・説明文から要約を生成するように変更。

**新たに可能になったこと**: diff取得に失敗するケース(大きすぎるPR、権限不足等)でも**要約が完全に欠落することがなくなった**(フォールバック生成)。

---

## 11. 失敗時のエラー情報をsummaryに記録(可視化)

**コミット**: [`def8bda`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/def8bda) (2026-03-24)
`debug: AI要約失敗時のエラー情報をsummaryカラムに記録`

**やったこと**: AI呼び出し失敗の原因を特定するため、エラーメッセージや想定外レスポンス形式を`summary`カラムに書き込んで可視化。

**新たに可能になったこと**: D1の`ai_summary_log.summary`を見るだけで**失敗理由が(推測でなく)直接わかる**ようになった。これがCLAUDE.mdルール12「D1の診断データを最初に見ろ」の`[AI_*]`プレフィックス方式の原型。

---

## 12. ロジックをaiSummary.tsに抽出しテスト追加

**コミット**: [`e3b47b0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e3b47b0) (2026-03-24)
`refactor: AI要約・diff取得・Slackメッセージ構築を関数に抽出しテスト追加`

**やったこと**: webhookハンドラに直書きされていたロジックを`aiSummary.ts`に抽出。21件のユニットテストを追加(diff取得の正常/切り詰め/HTTPエラー/ネットワークエラー、AI要約の正常/diffあり無し/null/空/想定外形式/例外、Slackメッセージ構築の各パターン)。

**新たに可能になったこと**: ハンドラ内の複雑な分岐が純粋関数として**単体テスト可能**になった(CLAUDE.mdルール15「テスト対象のロジックは関数に切り出してからテストしろ」を先取りする形の実例)。以降の機能追加が回帰なく進められるようになった。

---

## 13. 自動診断結果をai_summary_reviewsに記録

**コミット**: [`4c69fc8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4c69fc8) (2026-03-24)
`feat: AI要約結果の自動診断をai_summary_reviewsに記録`

**やったこと**: 要約生成後に`classifySummaryResult`で結果を分類し、`reviewer_type='system'`, `reviewer_name='auto-diagnosis'`として`ai_summary_reviews`に自動記録。分類例: `AI_ERROR`, `AI_EMPTY_RESPONSE`, `AI_UNEXPECTED_FORMAT`等。

**新たに可能になったこと**: 要約が失敗した場合の**原因分類がDBから直接確認できる**ようになった。これがCLAUDE.mdルール12の調査手順「①`ai_summary_reviews`の自動診断コメント確認→②`ai_summary_log.summary`確認→③デプロイ済みコード確認→④ドキュメント確認」の第1段階そのものになった。

---

## 14. runSummaryPipelineへ統合し「握りつぶし」を根絶

**コミット**: [`ad15f1b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ad15f1b) (2026-03-24)
`fix: AI要約パイプラインをrunSummaryPipelineに統合し握りつぶしを根絶`

**やったこと**: 全失敗パターン(binding未設定、例外throw、null/空レスポンス、想定外形式)で`summary`に必ず`[AI_*]`プレフィックス付きエラー情報を残すことを9件のテストで保証。「どのケースでも`summary`が空文字にならない」ことを網羅的にテスト。

**新たに可能になったこと**: **要約失敗が空文字やNULLとしてサイレントに握りつぶされるケースがゼロになった**ことがテストで保証された状態になった(CLAUDE.mdルール8「catchで握りつぶすなら3つの義務」の記録義務・テスト義務を満たす形の実装)。

---

## 15. NOTICE化(AI_MODEL設定・NULL問題の顛末を記録)

**コミット**: [`cee0253`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/cee0253) (2026-03-24)
`docs: AI_MODEL環境変数とsummary NULL問題の顛末をNOTICEに記録`

**やったこと**: `AI_MODEL`の設定方法(vars/secret/ダッシュボード)とデフォルト値、`summary`全件NULLの原因連鎖(diff失敗→AIスキップ→catch握りつぶし→空文字→NULL変換)、今後の調査手順を文書化。`wrangler.toml`に`AI_MODEL`のコメントを追加。

**新たに可能になったこと**: 10〜14節で場当たり的に直してきた一連のNULL問題の**全体像が1つのドキュメントから追跡できる**ようになった。

---

## 16. Slack表示の改善(ブロッククォート・詳細リンク)

**コミット**: [`75d4160`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/75d4160) (2026-03-24)
`feat: Slack要約をブロッククォート表示、UUIDを詳細ページリンク化、commentに抜粋追加`

**やったこと**: AI要約を`>`で囲んでSlack上で背景色付き表示。`requestId`をWorkerの`/api/ai-summary/:id`へのリンクに変換。`classifySummaryResult`のcommentに要約先頭80文字の抜粋を追加。

**新たに可能になったこと**: Slack上で要約が視覚的に見やすくなり、**Slackから詳細ページへ直接遷移できる**ようになった(ただしこの時点では外部URL遷移のため、次節の課題につながる)。

---

## 17. Slack Block Kit化 + モーダル表示

**コミット**: [`1667a5a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1667a5a) (2026-03-24)
`feat: Slack通知をBlock Kit化し、AI要約詳細をSlackモーダルで表示`

**やったこと**: UUIDリンクが外部URLへ遷移してOAuth再ログイン+生JSON表示になる問題を解消。「詳細を見る」ボタンをSlackメッセージに埋め込み、クリック時にSlack内モーダルでAI要約の全情報(リポジトリ、PR番号、モデル、diff長、要約テキスト等)を表示。
- `buildSlackMessage`: plain text → `{text, blocks}` (Block Kit)化
- `postSlackMessage`: `blocks`パラメータ対応
- `openSlackModal`: `views.open` APIラッパー追加
- `buildSummaryModal`: D1行データからモーダルビュー構築
- `verifySlackSignature`: Slack署名検証ユーティリティ追加
- `POST /slack/interactions`: ボタンクリック→D1照会→モーダル表示

**新たに可能になったこと**: Slackを離れることなく**要約の全詳細をモーダルで完結して確認できる**ようになった(16節の「外部URL遷移で生JSON表示になる」問題を根本的に解消)。

---

## 18. モーダルタイトルの微調整

**コミット**: [`567ad01`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/567ad01) (2026-03-24)
`fix: モーダルタイトルを「要約を表示」に変更 + テスト整理`

**やったこと**: Slackモーダルのtitleを「AI要約詳細」→「要約を表示」に変更。テストもfieldsテーブル形式の検証に更新。

**新たに可能になったこと**: UI文言の一貫性向上(機能追加なし)。

---

## まとめ: 今のPR要約セットアップに必要な最低条件

上記の積み重ねの結果、新しいリポジトリでPR要約機能を有効にするために必要なのは以下の状態である(詳細は[`NOTICE.cloudflare-workers-github-oauth-1.new-repo-setup.md`](NOTICE.cloudflare-workers-github-oauth-1.new-repo-setup.md)参照):

1. GitHub Appが対象リポジトリにインストールされ、Webhook配信先が`/webhook/github`を向いていること(4節の基盤)
2. `GITHUB_WEBHOOK_SECRET`が本体Workerと一致していること(2節のHMAC検証)
3. `GITHUB_TOKEN`(diff取得用)、`AI`バインディング(Workers AI)、`AI_MODEL`(任意、未設定時デフォルト)が設定されていること(4節・15節)
4. `SLACK_OAUTH_TOKEN`・`SLACK_CHANNEL_ID`が設定されていること(8節、未設定だとサイレントスキップされ警告ログのみ)
5. `ai_summary_log`・`ai_summary_reviews`テーブルがmigration適用済みであること(5節・9節)

これらが揃っていれば、PRの作成・更新(`opened`/`synchronize`)ごとに自動でAI要約→Slack通知(Block Kit+モーダル)→D1記録→自動診断、までの一連のパイプラインが動作する。

---

## 関連ファイル

| ファイル | 内容 |
|---|---|
| [`NOTICE.cloudflare-workers-github-oauth-1.new-repo-setup.md`](NOTICE.cloudflare-workers-github-oauth-1.new-repo-setup.md) | 新リポジトリをこのパイプラインに追加する際の手順・落とし穴 |
| [`NOTICE.cloudflare-workers-github-oauth-1.github-webhook-slack.md`](NOTICE.cloudflare-workers-github-oauth-1.github-webhook-slack.md) | webhook→Slack通知パイプライン全体像(経路A/B/Cの区別) |
| [`SPEC.cloudflare-workers-github-oauth-1.AI_MODEL.md`](SPEC.cloudflare-workers-github-oauth-1.AI_MODEL.md) | AI要約に使うモデルの設定 |
| [`CAUTION.cloudflare-workers-github-oauth-1.AI_MODEL.md`](CAUTION.cloudflare-workers-github-oauth-1.AI_MODEL.md) | AI_MODEL関連の注意点 |
