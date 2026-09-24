# SPEC.cloudflare-workers-github-oauth-1.dynamicneko-aichat-flow.md

## dynamicnekoから本体WorkerへのAI問い合わせ・応答フロー

**対象**: `POST /api/aichat/permission-external`・`POST /api/aichat/query-external` の2エンドポイント、D1 `dynamicneko_aichat_allowed_users`(`github_login`列を含む)・`ai_chat_shares` テーブル、`src/utils/dynamicnekoAichatPermission.ts` の許可・login解決ロジック、`src/utils/slackAiReply.ts` 等のモデル解決ロジック、`views/aichat.ts` の左サイドパネル・リクエスト元別円グラフ — 別デプロイのWorkerである `dynamicneko` の「AIに問い合わせ」ウィジェットから、本体WorkerのWorkers AIを呼び出して応答を返すまでの一連の経路。2026-09-10の1日で積み上げられた5コミットに加え、2026-09-14に発覚したセキュリティ脆弱性の修正2コミットの経緯をまとめる。

---

## 背景

`dynamicneko` は本体Workerとは別リポジトリ・別デプロイの実験用Workerである(`nekoserver/dynamicneko`、[`NOTICE.cloudflare-workers-github-oauth-1.new-repo-setup.md`](NOTICE.cloudflare-workers-github-oauth-1.new-repo-setup.md)参照)。この別Workerの「AIに問い合わせ」ウィジェットに、本体Worker側のWorkers AIバインディングを外部から呼び出させる機能を追加する過程で、認証・モデル選択・障害対応・可視化・集計精度の5段階が1日のうちに積み重なった。

**注意**: この経路は「dynamicneko → 本体Worker」への**Bearer secret認証によるHTTP呼び出し**であり、`/neko hellodw`コマンドが使う「本体Worker → dynamicneko」への**Service Binding経由のping**([`3bc1670`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3bc1670))とは向きも認証方式も別物。混同しないこと。

---

## 修正内容(時系列)

| # | 日付 | コミット | やったこと(変更) | 結果、何がどうなったか | 何ができるようになったか |
|---|---|---|---|---|---|
| ① | 2026-09-10 | [`5b3cb94`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5b3cb94) | 許可メールアドレスのみに制限するAPIを追加 | `POST /api/aichat/permission-external`(事前許可確認)と`POST /api/aichat/query-external`(AI問い合わせ本体)を新設。認証は`AICHAT_EXTERNAL_SECRET`によるBearer secret。`isDynamicnekoAichatAllowed`はD1の`dynamicneko_aichat_allowed_users`を参照し、DB未設定・クエリ失敗時はフェイルクローズ(`allowed:false`) | dynamicnekoの「AIに問い合わせ」ウィジェットから、許可されたメールアドレスのユーザーだけが本体WorkerのWorkers AIを呼び出せるようになった。クライアント側のグレーアウト表示に加え、サーバー側でも呼び出し直前に必ず再検証する二重チェック構成 |
| ② | 2026-09-10 | [`b1c6895`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b1c6895) | モデル選択(Gemma-4/Qwen-3.8)を追加 | `query-external`が`model`パラメータを受け付け、`resolveDynamicnekoAichatModel`が許可リストと照合。未指定・リスト外の値は常にデフォルト(Gemma-4)にフォールバック | dynamicneko側で問い合わせごとにAIモデルを選べるようになった。改ざんされた値をそのまま`AI.run()`へ渡さない安全性も確保 |
| ③ | 2026-09-10 | [`d706e1f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d706e1f) | Gemma-4のthinking mode暴走ハングを修正 | ②で選べるようになったGemma-4が`max_tokens`・`enable_thinking:false`等の回避策なしで呼ばれ、Cloudflare内部タイムアウト(エラーコード3046)までハングしていた不具合を発見。他エンドポイントと同じ`getModelRunParams`パターンを適用し`withTimeout(20秒)`を安全弁として追加、ハング再現→500エラー保証の回帰テストを追加 | dynamicneko側の読み込みインジケータが回ったまま止まって見える不具合が解消され、失敗時は20秒以内に明確なエラーが返るようになった |
| ④ | 2026-09-10 | [`ba91efa`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ba91efa) | AIチャット左サイドパネルで読み出せるように | `query-external`成功時に`saveDynamicnekoAiShare`が`ai_chat_shares`(`source='dynamicneko'`)へ保存。dynamicneko側のGitHubログインIDを本体Workerの`user_sessions.user_id`とみなしてそのまま紐付け、対応セッションが無ければ保存だけスキップ | dynamicnekoでの問い合わせ結果が本体Workerの`/aichat`左サイドパネルからも遡って読み返せるようになった |
| ⑤ | 2026-09-10 | [`a69197c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a69197c) | リクエスト元別円グラフで別集計するよう修正 | ④で保存された`source='dynamicneko'`のレコードが、`normalizeAichatSource`の「未知のsourceは全部api扱い」というフォールバックにより円グラフ上「回答伝播ページ(api)」に紛れ込んでいたバグを修正。専用の`dynamicneko`区分(ラベル「ダイナミックワーカー」、色`#10b981`)を追加 | 「日ごとキーワード数・質問数」モーダルの円グラフで、dynamicneko経由の問い合わせだけを独立した区分として正確に集計・可視化できるようになった |
| ⑥ | 2026-09-14 | [`4bdb102`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4bdb102) | `query-external`系がリクエスト本文の`login`を信用する脆弱性を修正 | 外部セキュリティレビューにより、`POST /api/aichat/query-external`・`POST /api/cursor-agent/query-external`がBearer secretと許可メールアドレスの検証はしていたものの、検索・保存対象の`user_id`(login)をリクエスト本文からそのまま受け取っていたことが発覚(PR #1809/#1810で混入)。Bearer secretと許可済みメール1件さえ知っていればloginを任意の値に差し替え、他ユーザーの質問・回答全文やAgent履歴を検索・書き込みできる状態だった。新設した`resolveDynamicnekoAllowedLogin`(`src/utils/dynamicnekoAichatPermission.ts`)が、サーバー側で検証済みのemailに紐づく`dynamicneko_aichat_allowed_users.github_login`だけを信頼するようにし、2エンドポイントで共通化。`github_login`未登録の許可済みメールは500で拒否し空文字user_idでの事故を防止。migration `0141`で`dynamicneko_aichat_allowed_users`に`github_login`列を追加 | dynamicneko側の「AIに問い合わせ」・CursorOpsの両ウィジェットで、他ユーザーのuser_idを騙って検索・書き込みすることができなくなった(脆弱性は修正済み) |
| ⑦ | 2026-09-14 | [`c7b677a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c7b677a) | `permission-external`が`github_login`未登録も`allowed:false`として返すよう修正 | ⑥までは`permission-external`が`isDynamicnekoAichatAllowed`(メールアドレスの許可リスト登録有無)しか見ておらず、`github_login`登録漏れの許可済みメールアドレスは「ボタンを押すまで使えないと分からない」状態だった(`query-external`側は500で拒否)。`resolveDynamicnekoAllowedLogin`の結果も見て、`github_login`未登録なら`allowed:false`を返すようにした | dynamicneko側のウィジェットが、`github_login`登録漏れのケースも事前にグレーアウト表示できるようになった(ウィジェット側の対応自体は別PR) |

---

## まとめ

「① 認証・許可制御を作る → ② 使い勝手(モデル選択)を足す → ③ 足した結果露呈した障害(ハング)を直す → ④ 結果をアプリ本体から見えるようにする → ⑤ 見えるようになった結果のデータが集計上正しく区分されるよう直す」という、機能追加・障害是正・可視化・可視化データの正確性担保が2026-09-10の1日のうちに一気通貫で積み上がった経緯になっている。

その4日後の2026-09-14には、外部セキュリティレビューをきっかけに「⑥ リクエスト本文のloginを信用していた脆弱性を塞ぐ(サーバー側の検証済みemailからのみloginを解決する) → ⑦ その修正で新たに生まれた『github_login未登録』ケースを事前チェック側(permission-external)にも波及させる」という、セキュリティ修正とその修正が生んだ副作用(UXの穴)への追従が1日のうちに連続して行われた。

---

## 関連ファイル

| ファイル | 内容 |
|---|---|
| [`dynamicneko-aichat-flow.html`](dynamicneko-aichat-flow.html) | 本ドキュメントのHTML版(表組みのみ) |
| [`NOTICE.cloudflare-workers-github-oauth-1.new-repo-setup.md`](NOTICE.cloudflare-workers-github-oauth-1.new-repo-setup.md) | dynamicnekoをエコシステムに組み込む一般手順 |
| [`pr-summary-saas-map.html`](pr-summary-saas-map.html) | dynamicneko・cf-authを含むSaaS/Worker構成全体図 |
