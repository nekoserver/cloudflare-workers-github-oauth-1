# NOTICE: GitHub webhook → Slack/外部Worker(Altワーカー) 通知パイプラインまとめ

**対象**: 本体Worker(`cloudflare-workers-github-oauth-1`)がGitHubから受け取ったwebhookイベントを、Slack、または`NOTIFY_TARGET=worker`切替時は外部Worker(`nekoserver/dynamicneko`の`cf-auth`、通称「Altワーカー」)へ通知するまでの全経路と、そこで実際に踏んだ落とし穴。今後この経路のどこかを触るときは最初に読むこと。関連スペック: [`SPEC.cloudflare-workers-github-oauth-1.AltSlackWorker.md`](SPEC.cloudflare-workers-github-oauth-1.AltSlackWorker.md)。

---

## 1. 全体像: 3種類の「webhook」が同じ語で呼ばれるので混同しやすい

この経路には見た目が似ていて紛らわしい、性質の異なる3つの通信が登場する。

| # | 経路 | 認証方式 | 通信手段 |
|---|---|---|---|
| A | GitHub → 本体Worker `/webhook/github` | `X-Hub-Signature-256`(`GITHUB_WEBHOOK_SECRET`とのHMAC) | 公開インターネット経由のGitHub公式webhook |
| B | dynamicneko/cf-auth → 本体Worker `/webhook/cf-auth`(ログイン通知) | `X-Hub-Signature-256`(`CF_AUTH_WEBHOOK_SECRET`とのHMAC、GitHub互換の自作署名) | **Service Binding**(`MAIN_WORKER`)経由、公開インターネットを通らない |
| C | 本体Worker → dynamicneko/cf-auth `/ingest`(Slack代替通知) | `Authorization: Bearer <NOTIFY_WORKER_SECRET>`(単純Bearer、HMAC署名ではない) | 公開URL(`NOTIFY_WORKER_URL`)への通常fetch |

3つとも「webhook」と呼ばれがちだが、**認証方式も通信経路も別物**。「webhookが届かない」と言われたら、まずA/B/Cのどれの話かを最初に特定すること。

## 2. 経路A: GitHub → 本体Worker `/webhook/github`

- `X-GitHub-Event`ヘッダーでイベント種別(`installation`/`repository`/`pull_request`等)を判定する。JSON本文の`action`フィールドは補助情報。
- `pull_request`イベントは`action`が`opened`または`synchronize`のときだけAI要約処理へ進む(`synchronize` = 既存PRへの新規push)。
- 受信ログは無条件で`webhook_log`テーブルに記録してから処理を分岐する(`logWebhookEvent`)。署名検証に失敗した場合も`rejected`として記録される。

## 3. 通知送信の切り替え: `NOTIFY_TARGET`

`src/utils/notifyDispatch.ts`が唯一の送信窓口。呼び出し側(PR要約通知・GitHub Appインストール通知・cf-authアクセス判定通知など)は`sendNotification()`だけ呼べばよく、送信先は`NOTIFY_TARGET`環境変数で一元的に決まる。

- 未設定 or `slack`以外の値 → 従来通りSlackへ投稿(`postSlackMessage`)
- `worker` → 外部Workerへ経路Cで送信(`sendToWorker`)

`isNotifyConfigured()`は`target`ごとに必要な設定(Slackなら`SLACK_OAUTH_TOKEN`+`SLACK_CHANNEL_ID`、workerなら`NOTIFY_WORKER_URL`)が揃っているかだけを見る。**設定が足りない場合は通知をスキップするが、AI要約自体やD1書き込みは止めない**(Slack依存を減らすための設計、`app.post('/webhook/github', ...)`内のコメント参照)。

## 4. 経路C: 本体Worker → Altワーカー `/ingest` — 送信ペイロードの形

`sendToWorker()`が送る本文は以下の固定形(Slack Block Kit風):

```json
{
  "channel": "SLACK_CHANNEL_ID相当の論理チャンネル名",
  "text": "本文(Markdownテーブル・箇条書きを含みうる)",
  "blocks": "Slack Block Kit形式(任意)",
  "thread_ts": "スレッド識別子(任意)",
  "source": "cloudflare-workers-github-oauth-1"
}
```

認証は`NOTIFY_WORKER_SECRET`を`Authorization: Bearer <secret>`ヘッダーに乗せるだけ。**環境変数名は送信側(`NOTIFY_WORKER_SECRET`)と受信側(dynamicneko/cf-authの`INGEST_SECRET`)で異なる**が、これは別リポジトリなので当然であり、揃えるべきは変数名ではなく**設定する値そのもの**。名前が違うことに気づかず「secretを設定したのに401になる」と混乱しないこと。

`sendToWorker()`はHTTPステータスが2xxかどうかしか見ておらず、レスポンス本文はエラー時のログ用に読むだけ。**送信側は「届いたかどうか」しか分からず、受信側が実際に何をしたか(記録できたか・表示されるか)までは関知しない。** これが次節の事故の温床になった。

## 5. 実際に起きた事故: 「200は返るが、どこにも表示されない」

dynamicneko/cf-auth側の`/ingest`実装は当初、受信データをKVに`ingest:{timestamp}:{uuid}`キーで書き込むだけで、**そのキーを読み出すコードがリポジトリ内のどこにも存在しなかった**。一方`/wspace`ページはD1の`ai_summary_log`を直接クエリして表示するだけで、KVのingestデータは一切見ていなかった。

結果、以下のような**PRのAI要約に紐付かない通知**が実質的に消滅していた:

- GitHub Appのインストール/アンインストール通知(`installation`イベント)
- cf-authのアクセス権限判定結果(経路Bとは別の、`dispatchNotification`経由の通知)

送信元(本体Worker)は200を受け取るので**エラーとして気づけない**。受信側もエラーは出ない(そもそも成功してKVに書けている)ので、**ログにも異常は残らない**。「webhookが処理されていないのに正常に見える」という、最も気づきにくい種類の不具合だった。

### 教訓

- **write-onlyなデータストアを作らない。書いたら必ずどこかで読む経路も同時に作る**、または最初から読む経路が無いなら書くこと自体をやめる。
- 送信側が2xxを受け取れても「相手が実際に使える形で記録・表示したか」までは保証されない。**受信側の処理が意味のある場所(この場合はD1・UI)まで到達しているかを、実装時に一度は目視で確認する**こと。
- Altワーカーのコード冒頭には`// Ingest endpoint (SPEC.cloudflare-workers-github-oauth-1.AltSlackWorker.md §2)`とスペックへの参照コメントがあったにもかかわらず、実装がスペック(D1の`alt_notify_ingest_log`テーブルへの記録)から逸脱していた。**スペック参照コメントがあるからといって、実装がスペック通りとは限らない**。疑わしければスペック本文と実装を突き合わせること。

### 修正内容(2026-09-10)

`/ingest`をD1の`alt_notify_ingest_log`テーブルへの書き込みに変更し、`/wspace`に`ai_summary_log`へ未リンクの生ログを表示する「その他のWebhook通知」セクションを追加した。D1書き込み失敗時は握りつぶさず500を返すようにし、送信元が異常に気づけるようにした。本体Worker側にも同じD1を参照するテーブル定義として`STATUS_TABLE_DEFINITIONS`等へ登録した(マイグレーション`0132`)。

## 6. Slack宛の別経路: `app_mention`イベントの`bot_id`判定

上記A〜Cとは別に、Slack Events APIの`/slack/event`で受ける`app_mention`イベントにも似た問題があった。当初は`event.bot_id`が付いているイベントを一律で無視しており、**他Bot経由の正当なメンションまで巻き込んで無視していた**(自分自身の発言だけを除外したいのに、条件が広すぎた)。

`SLACK_BOT_USER_ID`(自App自身のBot User ID、`U`始まり)を追加し、設定済みなら`event.user`と比較して自App自身の発言だけを除外するように変更した(未設定時は従来通りの安全側デフォルト)。確認方法: `curl -X POST https://slack.com/api/auth.test -H "Authorization: Bearer $SLACK_OAUTH_TOKEN"`の`user_id`フィールド。

## 8. 同じ「見た目は成功・実は経路が途切れている」パターン: GitHub Actionsのworkflowファイル配置ミス

5節のKV write-only事故と全く同じ性質の事故が、もう1段手前の「デプロイそのもの」でも起きていた。

dynamicneko/cf-authには`main`へのpushでCloudflare Workersへ自動デプロイするGitHub Actions workflowが用意されていたが、ファイルが`cf-auth/.github/workflows/deploy.yml`という**cf-authサブディレクトリの中**に置かれていた。**GitHub Actionsはリポジトリルート直下の`.github/workflows/`しか走査しない**ため、このworkflowは一度も実行されたことがなかった可能性が高い。

つまり「PRをマージした(≒`main`へのpushというGitHubイベントは正常に発生している)のに、その先の自動デプロイという処理が誰にも実行されていない」という、5節と同型の事故だった。`git push`自体は成功するので、この種のミスは**pushする側からは何も異常に見えない**のが厄介な点。

**対処**: `.github/workflows/deploy-cf-auth.yml`としてリポジトリルートへ移動し、`working-directory: cf-auth`を指定。あわせて`paths: ["cf-auth/**"]`フィルタを付けて無関係な変更では起動しないようにし、デプロイ前に`type-check`・`test`を実行するステップも追加した(元のworkflowにはテスト実行が無かった)。

**教訓**: モノレポ的にサブディレクトリを切っているリポジトリで「〇〇の中に`.github/workflows/`を置けばそのサブプロジェクトだけデプロイされるはず」という発想は**GitHub Actionsでは通用しない**(GitLab CIの`include`のような仕組みとは違う)。workflowは常にリポジトリルートの`.github/workflows/`に置き、対象を絞りたい場合は`paths`フィルタと`working-directory`で表現すること。新しいサブプロジェクトのCI/CDを追加するときは、**まずリポジトリルートに`.github/workflows/`があるかを確認してから**workflowファイルを作ること。

## 9. 調査の順番

「Slackやdynamicnekoに通知が来ない/見えない」と言われたら、次の順で切り分けること。

1. **どの経路の話か特定する**(1節の表)。GitHub上のイベント自体か、Slackへの投稿か、dynamicnekoの`/wspace`表示か。
2. `NOTIFY_TARGET`が意図通りの値(`slack`か`worker`)になっているか確認する。
3. 経路Cなら、本体Worker側のログ(`dispatchNotification`失敗時の`logger.error`)で送信自体が失敗していないか確認する。
4. 200が返っているのに見えない場合、**受信側が実際にデータを永続化し、かつそれを表示する経路が存在するか**を疑う(5節の事故と同じパターン)。
5. コードを直しても直らない場合、そもそも該当ブランチがマージ・デプロイされているか確認する。このリポジトリ・dynamicnekoともClaude Codeセッションから`wrangler deploy`はできないため、PRマージだけでは本番に反映されない。**さらに、マージすれば自動デプロイされる想定のリポジトリでは、そのworkflowファイルがリポジトリルートの`.github/workflows/`に正しく置かれているかも確認する**(8節)。GitHub Actionsタブで実際に該当のワークフロー実行が記録されているかを見るのが一番早い。
