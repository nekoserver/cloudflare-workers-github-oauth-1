# SPEC.slack.latest.md

## Slack関連機能の変遷(月別 → 週別に展開できる図)

**対象**: Slackへの通知送信・Slackからのwebhook受信(`/slack/interactions`・`/slack/event`・`/slack/commands`)・Slack Block Kit/モーダル表示など、Slackに関わる全機能。コミットログ(`git log`、日付は`origin/main`上の実コミット日)を月ごとにセクション分けし、各月の下に週(月曜始まり)単位で折りたたみ可能な`<details>`ブロックを配置した。クリックで該当週のコミット一覧(日付・変更内容・可能になったこと)が展開される。

---

## 2026年3月 — Slack通知の起点からBlock Kitモーダル化まで

Resend WebhookでのSlack通知を皮切りに、GitHub App Webhook基盤への統合、PR要約のSlack通知化、そしてBlock Kit化・モーダル表示を巡る集中的な試行錯誤(URLボタン⇄mrkdwnリンクの往復)がこの1ヶ月に集中している。

<details>
<summary><strong>3/9 〜 3/15 週</strong> — Resend WebhookでのSlack通知(起点、3件)</summary>

| 日付 | コミット | やったこと(変更) | 可能になったこと |
|---|---|---|---|
| 03-13 | [`c155d7d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c155d7d) | Resend Webhook受信時にSlack通知を追加 | メール配信イベントが初めてSlackに流れるようになった(Slack通知パターンの起点) |
| 03-13 | [`69079a8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/69079a8) | Resend Webhookの配信ステータスもSlackに投稿するよう拡張 | 配信成功/失敗の結果までSlackで追えるようになった |
| 03-13 | [`f4704b1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f4704b1) | Resend+Slack実装をまとめたSPECを追加 | この時点の設計が文書として残り、後続実装の参照点になった |

</details>

<details>
<summary><strong>3/16 〜 3/22 週</strong> — GitHub App Webhook基盤とSlack通知の統合、PR要約のSlack通知化(9件)</summary>

| 日付 | コミット | やったこと(変更) | 可能になったこと |
|---|---|---|---|
| 03-16 | [`688c22b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/688c22b) | `POST /webhook/github`でGitHub Appのinstallationイベントを受信し、ログイン失敗・JWT検証失敗・App権限変更時にSlack通知を追加 | GitHub側の異常・権限変更がSlackで即座に検知できるようになった(セキュリティ通知の起点) |
| 03-16 | [`7cd97d4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7cd97d4) | Slack通知のメッセージ形式を定型文から自然な日本語文に変更 | 通知が読みやすくなり、Slack上で状況判断しやすくなった |
| 03-16 | [`a4f10d0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a4f10d0) | リポジトリ一覧に「Slack連携済み」バッジを表示 | どのリポジトリがSlack通知対象かがUI上で一目でわかるようになった |
| 03-16 | [`1f7f076`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1f7f076) | Slack連携判定をWebhook送信先URLベースの判定方式に変更 | 外部API呼び出しなしでSlack連携有無を判定できるようになった |
| 03-16 | [`6d7f484`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6d7f484) / [`800871f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/800871f) | APIリファレンスをGitHub/Slack/Webhookセクションに分離・更新 | 実装とドキュメントが同期し、以降の変更点を追いやすくなった |
| 03-21 | [`47480eb`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/47480eb) | `pull_request`イベントでdiffをWorkers AIが要約し、結果をSlackに投稿する処理を追加 | PRの作成・更新が自動で日本語要約され、Slackに通知される状態が初めて実現した |
| 03-21 | [`55cd1e3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/55cd1e3) | 本日の通算番号・`crypto.randomUUID()`による固有IDをSlack投稿フッターに表示、D1にログ記録 | Slack投稿1件ずつを一意なIDで参照・追跡できるようになった |
| 03-22 | [`4aba1a3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4aba1a3) | `postSlackMessage()`の戻り値`{ok:false}`を検査せず常に成功扱いにしていたバグを修正、環境変数未設定時の警告ログを追加 | Slack投稿が実際に失敗しているのにD1上は成功と記録される、というサイレント障害を検知できるようになった |

</details>

<details>
<summary><strong>3/23 〜 3/29 週</strong> — Block Kit化・モーダル表示・プラットフォーム制約の確定(最多集中、28件)</summary>

この1週間(実質3/24〜3/29)で「詳細を見る」導線をボタン⇄リンクの間で何度も往復し、Slack Block Kitの実機制約(モーダル内ではURLボタンが使えない等)を確認しながら固めた。

| 日付 | コミット | やったこと(変更) | 可能になったこと |
|---|---|---|---|
| 03-24 | [`e3b47b0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e3b47b0) | AI要約・diff取得・Slackメッセージ構築ロジックを関数に抽出し21件のユニットテストを追加 | Slackメッセージの組み立てが単体テスト可能になった |
| 03-24 | [`75d4160`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/75d4160) | 要約を`>`ブロッククォートで表示、UUIDをWorkerの詳細ページへのリンクに変換 | Slack上で要約が見やすくなり、詳細ページへの導線ができた |
| 03-24 | [`1667a5a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1667a5a) | Slack通知をBlock Kit化、「詳細を見る」ボタン→`views.open`でSlack内モーダル表示、`verifySlackSignature`追加、`POST /slack/interactions`新設 | 外部URL遷移(OAuth再ログイン+生JSON表示)を経ずにSlack内で要約全文を確認できるようになった |
| 03-24 | [`567ad01`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/567ad01) | モーダルタイトルを「AI要約詳細」→「要約を表示」に変更、テスト整理 | UI文言の一貫性向上 |
| 03-24 | [`f76b548`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f76b548) | Slack APIレスポンスのJSON parse失敗を握りつぶさず記録するよう修正 | Slack APIが想定外応答を返した場合も原因を追跡できるようになった |
| 03-24 | [`c9d6e37`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c9d6e37) | Slack API正常系テストを充実化 | 回帰を防ぐテストカバレッジが強化された |
| 03-24 | [`9e6bc5f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9e6bc5f) | Slack PR通知にコードブロック書式・初期設計との差異セクションを追加 | 通知本文だけで実装が当初設計とどう違うかまで確認できるようになった |
| 03-24 | [`a445cf4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a445cf4) | `/slack/interactions`にD1診断ログを追加し「詳細を見る」ボタン失敗原因を特定 | ボタンクリック失敗時の原因をD1から追跡できるようになった |
| 03-24 | [`4c3cbb6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4c3cbb6) → [`88f0928`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/88f0928) → [`e271ca2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e271ca2) | 詳細ボタンを「Interactivity設定不要のmrkdwnリンク」⇄「actionsボタン」で往復して検証 | Interactivity設定有無による挙動差を実地で確認し、actionsボタン前提の構成に確定した |
| 03-24 | [`eecaa8f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/eecaa8f) | `/slack/interactions`ハンドラをテスト可能な関数に抽出 | インタラクション処理も単体テストの対象にできるようになった |
| 03-24 | [`ea59541`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ea59541) | 正常系テストで`openSlackModal`への実引数とモーダル構造を検証 | モーダルの組み立て内容自体が誤っていないかテストで保証されるようになった |
| 03-24 | [`9dfc126`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9dfc126) | 罫線文字(`├`等)を箇条書きに変換、AIプロンプトにも罫線禁止指示を追加 | Slack上で罫線が環境依存で崩れる問題を防止(CLAUDE.mdルール16の原型) |
| 03-24 | [`337a6e9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/337a6e9) | 「HTMLで表示」リンクをアクションボタン+`views.update`方式に変更 | モーダルを開いたまま別ビューに切り替える導線ができた |
| 03-27 | [`367b71f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/367b71f) | メッセージ側の「HTMLで表示」をURL型ボタンに変更、summary本文の罫線除去を追加 | メッセージ上のリンクはURLボタンで正しく動作することを確認 |
| 03-27 | [`1415442`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1415442) | モーダル側の「HTMLで表示」はactionsボタンからmrkdwnリンクに変更 | モーダル内ではURLボタンが機能しない制約に対応 |
| 03-27 | [`f377daf`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f377daf) | AIエラー時にSlack通知でエラー内容自体を表示するよう変更 | 要約失敗がSlack上でも(D1を見なくても)わかるようになった |
| 03-27 | [`cff1045`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/cff1045) | AI要約エラー(`[AI_ERROR]`等)を`:warning:`付きでSlack通知し管理者に設定確認を促す文言を追加 | 失敗が握りつぶされず、対応が必要なことがSlack上で明示されるようになった |
| 03-27 | [`600ccd3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/600ccd3) | 「モーダルURLボタン禁止・リンクパターン・エラー可視化」を検証するBlock Kit制約テストを追加 | Slack Block Kitの制約が仕様としてテストに固定され、以後の実装が守るべきルールになった |
| 03-28 | [`ced7efc`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ced7efc) | Slackメッセージに「HTMLで表示」ボタンを2ボタン構成で復元 | メッセージ上で「詳細を見る」「HTMLで表示」の両方に個別アクセスできるようになった |
| 03-28 | [`4ad6e02`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4ad6e02) | モーダル内「HTMLで表示」をmrkdwnリンクに再変更 | 3/27の制約テストに沿った実装がモーダル側にも一貫して適用された |
| 03-28 | [`d9d6118`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d9d6118) | Slack制約テストを実証済みの事実に基づいて書き直し | 推測ではなく実際に確認した制約だけがテストとして残る状態になった |
| 03-28 | [`390c6f6`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/390c6f6) | Slackメッセージのボタン表記を調整 | 文言の最終調整 |
| 03-28 | [`50691c1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/50691c1) | 「AI要約→Slack通知+HTMLワークフロー」のSPECを追加(8割完成として記録) | 3/24〜3/28の試行錯誤の到達点が1つの設計文書としてまとまった |
| 03-28 | [`eaf3949`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/eaf3949) | ジョブキューからのビルド通知をSlackに送る設定のテストコミット | ビルド通知経路の疎通確認 |
| 03-29 | [`f977bb3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f977bb3) | AIモデルのフォールバック発動時にSlack通知で明示 | どのモデルで要約が生成されたか(フォールバックか)がSlack上でもわかるようになった |
| 03-29 | [`c21b0ed`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c21b0ed) | AI要約エラー時のSlack通知を3パターンに分岐して明示 | エラー種別ごとに異なるメッセージが表示され、原因の当たりをつけやすくなった |

</details>

---

## 2026年4月 — 運用ルールの明文化

<details>
<summary><strong>3/30 〜 4/5 週</strong> — PR/Slack翻訳運用のドキュメント化(1件)</summary>

| 日付 | コミット | やったこと(変更) | 可能になったこと |
|---|---|---|---|
| 04-01 | [`6b4915c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6b4915c) | CLAUDE.mdに「PR日本語運用」「AI要約Slack翻訳方針」を追記 | 英語PRを翻訳してから要約しSlackへ日本語のみ投稿する、という運用ルールが明文化された(現CLAUDE.mdルール19) |

</details>

---

## 2026年6月 — cf-authからのSlack通知経路の新設(前段)

<details>
<summary><strong>6/15 〜 6/21 週</strong> — cf-auth webhookエンドポイントの追加(1件)</summary>

| 日付 | コミット | やったこと(変更) | 可能になったこと |
|---|---|---|---|
| 06-19 | [`5e9ce1c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5e9ce1c) | `POST /webhook/cf-auth`を新設し、cf-authログイン結果をSlack通知 | cf-authでのログインイベントが本体Worker経由でSlackに流れるようになった(`/webhook/github`とは別系統のwebhook) |

</details>

---

## 2026年7月 — 双方向化・Slack依存の切り離し(最大の転換期)

cf-auth連携の完成、Slackスラッシュコマンド・Events APIによる「Slack→アプリ」の入力実装、そしてSlackを「唯一の通知先」から「切り替え可能な1つ」へ格下げする設計変更がこの1ヶ月に集中している。

<details>
<summary><strong>6/29 〜 7/5 週</strong> — cf-auth連携完成、双方向化(スラッシュコマンド/Events API)、通知の外部化(13件)</summary>

| 日付 | コミット | やったこと(変更) | 可能になったこと |
|---|---|---|---|
| 07-02 | [`82c453d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/82c453d) | cf-auth webhookでHMAC検証後、`user_sessions`照合結果をOK/NGで返すよう変更 | 呼び出し元(cf-auth)が本体アプリへのアクセス権限有無を判定できるようになった |
| 07-02 | [`12c0f2e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/12c0f2e) | 判定結果を`cf_auth_access_log`テーブルに記録 | Slack通知だけでなくD1にも履歴が残り、後から判定結果を検索できるようになった |
| 07-03 | [`41abbde`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/41abbde) | フリーワードをSlackに投稿できる`/tsubuyaki`ページ(`GET /tsubuyaki`・`POST /api/tsubuyaki`)を追加 | Webページからボタン操作だけで任意の文章をSlackへ投稿できるようになった |
| 07-03 | [`2c10c88`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2c10c88) | `/tsubuyaki`をSlackスラッシュコマンド(`POST /slack/commands`)としても有効化、署名検証・7パターンのテストを整備 | Slack上から直接コマンドで投稿できる双方向の入口ができた |
| 07-03 | [`5308c5f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5308c5f) | スラッシュコマンドを`/tsubuyaki`から`/pts`に短縮 | コマンド入力の手間が減った |
| 07-04 | [`2c8df76`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2c8df76) | `POST /slack/event`を新設し、Slack Events APIの`url_verification`チャレンジに応答 | Slack App側でEvent Subscriptionsの疎通確認が通るようになった |
| 07-04 | [`5b0ccbe`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5b0ccbe) | Bot(`@neko`)へのメンションをAIチャットAPIに渡して応答するSlack連携を実装 | Slack上でメンションするだけでAIチャットの応答が得られるようになった |
| 07-04 | [`fbe873a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fbe873a) | `/slack/interactions`にメッセージショートカットを追加しAI応答経路を統一 | メンション以外からもAI応答を呼び出せるようになった |
| 07-04 | [`7239d49`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7239d49) | `@admin`メンション無応答の原因(モデルのthinking mode混入でSlack投稿失敗)を特定し、デフォルトモデルを戻す | Slack投稿失敗時に何も表示されず気づけない障害パターンを解消し、`@admin`メンションが再び応答するようになった |
| 07-05 | [`6705178`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6705178) | `/pts f1`サブコマンドでF1開催予定を投稿できるように | 1つのURLで複数コマンドを扱う設計が実際に活用され始めた |
| 07-05 | [`97b877a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/97b877a) | GitHub PR WebhookのAI要約・D1記録をSlack設定への依存から切り離し、常時書き込み方式に変更 | Slack連携を外しても要約データはD1に蓄積され続けるようになった |
| 07-05 | [`f5e89e0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f5e89e0) | 各所に散在していた`postSlackMessage`呼び出しを`notifyDispatch.ts`の`sendNotification`に統一、`NOTIFY_TARGET`で送信先を切替可能に | 環境変数1つで通知先をSlackから別Worker(NOTIFY_WORKER_URL)へ丸ごと切り替えられるようになった |
| 07-05 | [`5b3d32a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5b3d32a) | 別Worker(Altワーカー)でのSlack代替表示・`@admin`問い合わせ仕様をSPECに記載 | Slackからの段階的離脱に向けた移行先の設計が文書化された |

</details>

<details>
<summary><strong>7/6 〜 7/12 週</strong> — Slack通知のユーザーオプション化(1件)</summary>

| 日付 | コミット | やったこと(変更) | 可能になったこと |
|---|---|---|---|
| 07-10 | [`276f13c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/276f13c) | Slack通知8箇所すべてをD1管理のON/OFFユーザーオプション(デフォルトOFF)でゲート可能に、`GET/POST /api/settings/slack-notify`を追加 | ベンダーロックイン回避を見据え、コード変更なしでSlack通知の一括ON/OFFが切り替えられるようになった。外部サービス(cf-auth等)からも現在値を参照可能に |

</details>

---

## 2026年8月 — Slack応答の品質改善

<details>
<summary><strong>8/3 〜 8/9 週</strong> — @メンションAI応答の保存・表示品質修正(6件)</summary>

`@メンション`によるAIチャット応答がユーザーページから見えない・フリーズする等の不具合をまとめて解消した週。

| 日付 | コミット | やったこと(変更) | 可能になったこと |
|---|---|---|---|
| 08-07 | [`d605c48`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d605c48) | Slackメンション経由のAI応答を`ai_chat_shares`へ保存、`/slack/*`アクセスを`/api/*`とは別枠で集計 | `/aichat`ページからSlack経由の会話も参照でき、Slack経由のAPI利用状況も独立して集計できるようになった |
| 08-07 | [`ac9d8c2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ac9d8c2) | SlackへのAI応答をコードブロック内に収まる形式で返信するよう変更 | Slack上でMarkdown崩れなく応答が表示されるようになった |
| 08-07 | [`ccd8154`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ccd8154) | SlackのAI応答モデルを`gemma-4-26b-a4b-it`に変更しMarkdown形式で返信 | 応答モデルの切替と表示形式の統一 |
| 08-07 | [`c6a066b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c6a066b) | Slack応答ログを開くとページが固まるバグを修正 | 応答ログの閲覧が正常にできるようになった |
| 08-07 | [`9661e38`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9661e38) | Slack応答のコードブロックが閉じられず表示崩れするバグを修正 | Slack上の表示崩れが解消された |
| 08-07 | [`b93ba6c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b93ba6c) | AIチャット3経路の共通化/個別特化の現状と、トークン上限流用によるフリーズバグの教訓をNOTICEに記録 | 同種の不具合を将来再発させないための知見が残された |

</details>

---

## 2026年9月 — セキュリティ通知としての活用と直近の整理

<details>
<summary><strong>8/31 〜 9/6 週</strong> — 公開鍵ログイン異常検知のSlack通知(1件)</summary>

| 日付 | コミット | やったこと(変更) | 可能になったこと |
|---|---|---|---|
| 09-04 | [`cd882a0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/cd882a0) | 公開鍵ログインの異常(鍵未検出・署名不一致)を`public_key_security_events`に記録し同時にSlack通知(DB記録失敗時もSlack通知は継続、通知失敗時もログイン処理は継続) | 秘密鍵の不正利用が疑われるケースをSlackで即座に検知できるようになった |

</details>

<details>
<summary><strong>9/7 〜 9/13 週</strong> — bot判定修正と知見の文書化(2件)</summary>

| 日付 | コミット | やったこと(変更) | 可能になったこと |
|---|---|---|---|
| 09-09 | [`74666f1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/74666f1) | Slack `app_mention`のbot一律除外を「自App自身のみ除外」に変更 | 他のSlack Botからのメンションにも応答できるようになった(誤って全bot除外していた不具合の修正) |
| 09-09 | [`de68131`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/de68131) | GitHub webhook→Slack/外部Worker通知パイプラインの知見をNOTICEにまとめる | 経路A/B/Cの区別など、通知の全体像が1つの文書から追跡できるようになった |

</details>

---

## 現在地(2026-09-11時点)まとめ

- **受信系(Slack→Worker)**: `POST /slack/interactions`(ボタン・ショートカット)、`POST /slack/event`(Events API・メンション)、`POST /slack/commands`(スラッシュコマンド`/pts`)の3経路。すべて`verifySlackSignature`で署名検証。
- **送信系(Worker→Slack)**: `src/utils/notifyDispatch.ts`の`sendNotification`に一本化。`NOTIFY_TARGET`でSlack/外部Workerを切替可能、D1の`notification_settings`(デフォルトOFF)でユーザーが一括ON/OFFできる。
- **データ非依存性**: PR要約・cf-authアクセス判定などのD1記録はSlack設定の有無に依存せず常時実行される(07-05 `97b877a`で分離済み)。
- **既知の制約(テストで固定済み)**: モーダル内ではURLボタンが使えずmrkdwnリンクで代替する必要がある(`600ccd3`・`d9d6118`)。
- **将来方針**: ベンダーロックイン回避のため、Slackから別Worker(Altワーカー)への段階的移行が計画されている(`5b3d32a`、`276f13c`)。

---

## 関連ファイル

| ファイル | 内容 |
|---|---|
| [`NOTICE.cloudflare-workers-github-oauth-1.github-webhook-slack.md`](NOTICE.cloudflare-workers-github-oauth-1.github-webhook-slack.md) | GitHub webhook→Slack/外部Worker通知パイプラインの経路A/B/C整理 |
| [`SPEC.cloudflare-workers-github-oauth-1.AltSlackWorker.md`](SPEC.cloudflare-workers-github-oauth-1.AltSlackWorker.md) | Slackからの段階的移行先(Altワーカー)の設計 |
| [`NOTICE.cloudflare-workers-github-oauth-1.setup-pr-summary.md`](NOTICE.cloudflare-workers-github-oauth-1.setup-pr-summary.md) | PR要約パイプライン全体(Slack以外のGitHub/Workers AI/D1部分含む)の経緯 |
| [`SPEC.cloudflare-workers-github-oauth-1.20260328.md`](SPEC.cloudflare-workers-github-oauth-1.20260328.md) | AI要約→Slack通知+HTMLワークフローの設計(2026-03-28時点、8割完成時点の記録) |
| [`auth-flow.html`](auth-flow.html) | 認証・Revokeフロー図。通知(Slack/外部Worker切替・既定OFF)の分岐箇所を含む |
