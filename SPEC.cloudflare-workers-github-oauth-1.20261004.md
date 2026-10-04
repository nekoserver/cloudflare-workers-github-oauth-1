# SPEC.cloudflare-workers-github-oauth-1.20261004

## GitHub push/PR通知パイプラインの修正(rails-rootのコミットログ・PR要約がcf-authで読めるようになるまで)

**対象**: `/webhook/github`のpushイベント処理(`src/index.ts`)、`src/utils/notifyDispatch.ts`(経路C送信)、
`src/utils/githubPushNotify.ts`(push用の通知文・AI要約入力・diff URL組み立て)、`src/utils/aiSummary.ts`
(`/view`・`/ai-summary/:id`の表示整形)、および`nekoserver/dynamicneko`の`cf-auth/src/feed.ts`・
`cf-auth/src/index.ts` — rails-rootのように、PRを経由せず直接pushされるリポジトリのコミット・AI要約が、
Altワーカー(`dynamicneko/cf-auth`)の`/wspace`から読み出せるようになるまでの一連の修正。

### 背景

「rails-rootのコミット要約がcf-authで読み出せない」という報告を調査した結果、1つではなく複数の
独立した欠落が重なっていたことが分かった。

1. push通知(Slack/Altワーカー向け)の`channel`欄が常にSlackチャンネルID固定で、Altワーカー側で
   リポジトリ単位に絞り込めなかった
2. Altワーカー(cf-auth)側も、リポジトリ絞り込み中は`alt_notify_ingest_log`を常に空扱いし、
   PRサマリーが無いリポジトリはチャンネル一覧にも出ない作りだった
3. そもそも`/webhook/github`のpush処理は、通知テキストを組み立てるだけで`ai_summary_log`への
   記録(AI要約)を一切行っていなかった。PRの`opened`/`synchronize`イベントだけがAI要約を生成する
   ため、PRを経由しないリポジトリは原理的に「要約」が存在しなかった
4. push用のAI要約を追加した直後は、コミットメッセージだけで要約しdiffを取得していなかったため、
   詳細ページ(`/view`・`/ai-summary/:id`)が「PR #null」「Diff長 0 文字」という、PR向けテンプレートを
   そのまま使い回したことによる誤解を招く表示になっていた
5. 4の表示を帳尻合わせで直した後、「本来あるべき姿にできないの？」という指摘を受け、pushでも
   PRと同様に実際のdiffを取得してAI要約・Diff長の根拠にするよう、根本から修正した

### 修正内容

| # | コミット | 変更概要 |
|---|---|---|
| 1 | [`d397442`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d397442) | `NotifyMessage`に`channel?: string`を追加し、`target='worker'`のときだけ`message.channel`(省略時は従来通り`config.slackChannel`)を使うようにした。pushハンドラは`channel: repositoryFullName`を渡す |
| 2 | [`3d70041`](https://github.com/nekoserver/dynamicneko/commit/3d70041b526752615b5ca1e462b6752e9691962e)(dynamicneko/cf-auth) | `getChannels`を`ai_summary_log`と`alt_notify_ingest_log.channel`のUNION ALLに変更。`getUnlinkedIngestLogByChannel`を追加し、リポジトリ絞り込み中でも該当チャンネルのingestログを表示するようにした |
| 3 | [`1ad8106`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1ad8106) | `buildPushSummaryInput`(コミットメッセージ一覧からAI要約への入力を組み立てる)を追加。pushイベントでも`runSummaryPipeline`を呼び、`event_type='push_summary'`として`ai_summary_log`へ記録するようにした。diff本体はこの時点ではまだ取得していない |
| 4 | [`e56bf85`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e56bf85) | `formatSummaryPrLink`/`formatSummaryDiffLength`を追加し、`/view`・`/ai-summary/:id`で`pr_number`がnull(push由来)の場合に「PR #null」「0 文字」ではなく専用の表示に切り替えた |
| 5 | [`b57827e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b57827e)(PR [#2246](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/2246)) | `buildPushCompareDiffUrl`(compare URLに`.diff`を付けるだけ)を追加し、PRと同じ`fetchPrDiff`でpushのdiffも実際に取得するようにした。取得したdiffをAI要約・`diff_length`の根拠にする。これにより4で追加したpush専用のDiff長表示は不要になり、`formatSummaryDiffLength`はPR/push共通の単純な表示に戻した(`formatSummaryPrLink`はPR番号自体が存在しないという構造上の違いのため維持) |

### 得られた設計上の教訓

- **`ai_summary_log`は元々PR専用ではなく汎用テーブルだった**: `pr_number`/`pr_action`/`pr_url`は
  いずれもnullable、`event_type`もデフォルト値付きの汎用カラムで、push用に新しいテーブルを作る
  必要が無かった。cf-auth側の`getFeed`/`getChannels`も`repo_full_name`で汎用的にクエリしていたため、
  push summaryを追加するだけでcf-auth側のコード変更は不要だった(表示の整形部分だけ直せば済んだ)。
- **「生テキスト通知が読めること」と「AI要約が読めること」は別物**: 最初の2件(経路Cの`channel`、
  cf-auth側のingestログ絞り込み)はSlack/Altワーカー向けの通知テキストをcf-authから読める
  ようにしただけで、「要約」そのものは別のテーブル(`ai_summary_log`)に依存していた。
  「まだ読めない」という報告を鵜呑みにして同じ経路を疑い続けず、「要約」という言葉が指す
  データソースを都度確認する必要があった。
- **push用の新機能をPRのコード・テーブルにどれだけ相乗りさせるか**: 今回は`runSummaryPipeline`・
  `fetchPrDiff`・`ai_summary_log`をすべてPRと共用し、pushイベント固有のコードは「compare URLから
  diff_urlを組み立てる」「コミットメッセージ一覧からtitle/descriptionを組み立てる」という
  入力変換部分のみに留めた。表示側の特別扱い(4)は一時的な帳尻合わせであり、5で入力側(diff取得)を
  揃えたことで不要になった。**一時的な表示上の特別扱いを入れるときは、根本(データの欠落)を
  後で解消したら特別扱い自体を削除できるよう、どこが特別扱いなのかをコメントで明示しておくこと。**

### テスト

- `src/utils/notifyDispatch.test.ts`: `message.channel`の優先順位(worker宛では優先、slack宛では無視)
- `src/webhook-github-push-notify-20261001.test.ts`: push通知のchannel・AI要約記録・diff取得の一連を実リクエストで検証
- `src/utils/githubPushNotify.test.ts`: `buildPushSummaryInput`・`buildPushCompareDiffUrl`の単体テスト
- `src/utils/aiSummary.test.ts`: `formatSummaryPrLink`・`formatSummaryDiffLength`の単体テスト
- `nekoserver/dynamicneko`の`cf-auth/test/feed.test.ts`: `getChannels`のUNION・`getUnlinkedIngestLogByChannel`の単体テスト

### 注意事項

- diff取得(`fetchPrDiff`)は`GITHUB_TOKEN`に依存する。未設定の場合はPRと同様に取得を省略し、
  `diff_length`は0のままになる(AI要約はコミットメッセージのみの根拠になる)。
- push 1件ごとにGitHub APIへのdiff取得リクエストが1回増える。pushのコミット数が多い場合でも
  diff取得自体は1回(compare全体)で済むため、コミット数に比例してAPI呼び出しが増えることはない。
- このセッションからは`CLOUDFLARE_API_TOKEN`が無く`wrangler d1 execute --remote`が使えないため、
  D1の実データでの裏取りはできず、コード読解のみで原因を特定した。本番での実際の動作確認は
  デプロイ後にユーザー側で行う必要がある。
