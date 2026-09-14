# NOTICE: CursorOps(dynamicneko)「回答はまだキャッシュされていません」問題

## 症状

dynamicneko側の新規ページ `/cursor-ops`(cursor cacheモジュール)でキーワード検索すると、
質問(prompt)はヒットするのに回答欄が常に「(回答はまだキャッシュされていません)」になる。

一方、本体WorkerのAIチャット `/neko csearch` の検索結果から「表示」リンクを押すと、
同じ質問に対する回答本文を実際に読むことができる。

## 実データで確認した事実

ユーザーが本番D1で以下を実行し、結果を確認した。

```sql
SELECT COUNT(*) AS cache_row_count FROM cursor_agent_answer_cache;
```

→ **`cache_row_count = 0`**(本番D1のこのテーブルには1行も無い)。

## 根本原因

`cursor_agent_answer_cache` への書き込みは
`GET /api/cursor-agent/history/:id/conversation`(AIチャットの「表示」リンクが呼ぶAPI)
の中で、**その時点で `cursor_agent_status_log` に記録されている最新行が
`isCursorAgentSuccessfulTerminal`(agent_statusがFINISHED/COMPLETED、または
run_statusがCOMPLETED)を満たす場合のみ**行われる設計になっている
(意図的な設計: RUNNING中の未確定な回答を誤ってキャッシュに固定しないためのガード。
`src/cursor-agent-launch.test.ts` の「RUNNING中の非空回答はキャッシュせず」テストが
この意図を保証している)。

ところが `cursor_agent_status_log` は **launch直後の状態(RUNNING等)のまま二度と
更新されないことがある**。更新されるのは以下の経路だけ:

- `/cursor-agent` ページを開いたときの自動リフレッシュ(未終了行だけを対象)
- `POST /api/cursor-agent/history/:id/refresh` を明示的に呼んだとき

AIチャットの `/neko csearch` 経由で「表示」を押しても、この
`GET .../conversation` エンドポイント自体は `cursor_agent_status_log` を
**読むだけで更新しない**。そのため、`/cursor-agent` ページを一度も開かずに
`/neko csearch` だけを使っているユーザーの起動記録は、実際のAgentがとっくに
完了していても `cursor_agent_status_log` 上は永久に「RUNNING」等の非終了状態の
ままとなり、`isCursorAgentSuccessfulTerminal` が常にfalseになる。結果として
**回答は毎回ライブでCursor APIから正しく取得・表示されるのに、キャッシュへの
書き込みだけが永遠にスキップされ続ける**。

`cursor_agent_answer_cache` が本番で0件だったのは、このためだと判断した
(全ユーザーの全起動でこの経路のみ使われ、`/cursor-agent`ページ自体があまり
使われていない可能性が高い)。

## 対処方針

`GET /api/cursor-agent/history/:id/conversation` 内で、DB上の最新状態が
非終了扱いのときは、会話取得の前に `POST .../refresh` と同じ
Cursor APIステータス問い合わせ(`GET /v1/agents/{id}`)を行って
`cursor_agent_status_log` を最新化してから `isCursorAgentSuccessfulTerminal`
を再判定する。CURSOR_API_KEY未設定時や既に終了扱いの場合は追加の問い合わせを
行わない(既存の動作を変えない)。RUNNING中の回答を誤ってキャッシュしない
というガード自体は変更しない(値を鮮度の高いものにするだけ)。

## 対応PR

この修正は `nekoserver/cloudflare-workers-github-oauth-1` の
`GET /api/cursor-agent/history/:id/conversation` に対して実施した。
関連コミット: [`983b9f1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/983b9f1)

## 続報(2026-09-14): #1811適用後もcache_row_count=0のまま → 真の根本原因を特定

#1811(上記の「DB上が非終了のときだけ再取得する」対処)を適用・デプロイ後、
AIチャットで実際に「表示」を押した直後でも `cache_row_count` は引き続き
`0` のままだった。ユーザーの指摘(「未キャッシュだからと言って課金が
怖くなるほどAPIを叩くな。まずキャッシュがそもそも存在しない事実を問題にしろ」)
を受け、無闇にライブ問い合わせを増やすコード(CursorOpsに「回答を取得」
ボタンを追加する案)は着手前に破棄し、まず実データで再調査した。

`cursor_agent_status_log` を見ると、「表示」を押した直後の新しい行
(`fetched_at`が最新)は実際に増えていた(=ライブ再取得の呼び出し自体は
動いている)が、`agent_status`・`run_status`が**両方ともNULL**だった。
該当行の`raw_response`を直接見たところ、実際のステータス確認用エンドポイント
(`GET /v1/agents/{id}`)のレスポンスは次の形だった。

```json
{"id":"bc-ce09778b-69b0-4ca6-956b-92502fca800c","name":"Claude CLI機能一覧","status":"IDLE","env":{"type":"cloud"},"repos":[{"url":"https://github.com/nekoserver/cloudflare-workers-github-oauth-1"}],"workOnCurrentBranch":false,"openAsCursorGithubApp":false,"skipReviewerRequest":false,"url":"https://cursor.com/agents/bc-ce09778b-69b0-4ca6-956b-92502fca800c","createdAt":"2026-09-14T01:38:09.293Z","updatedAt":"2026-09-14T01:39:40.897Z","latestRunId":"run-a9918391-e9c1-40c7-9cbb-2dff196af2c0"}
```

**真の根本原因**: 起動時レスポンス(`POST /v1/agents`)は`{agent:{...}, run:{...}}`
という入れ子構造だが、ステータス確認用エンドポイント(`GET /v1/agents/{id}`)は
**`agent`キーによるラップが無く、id・name・status・url等がレスポンスの
トップレベルに直接入ったフラットな構造**で返ってくる。`extractCursorAgentFields`
(および内部で使う`extractCursorAgentId`)は`cursorResponse.agent.status`
という入れ子前提でしか読んでおらず、フラットな形からは何も取り出せず
常にnullになっていた。加えてステータス値自体も`FINISHED`/`COMPLETED`
ではなく`IDLE`(実行中の作業が無い状態)だった。

これにより#1811の「非終了なら再取得する」ロジック自体は正しく動作して
いたが、再取得した結果を正しく解釈できず、`isCursorAgentSuccessfulTerminal`
が永遠にfalseのまま(`agent_status`/`run_status`が両方NULL)になり、
キャッシュ書き込み条件を満たせなかった。

### 対応

- `extractCursorAgentId`・`extractCursorAgentFields`: `agent`キーが無い
  場合、レスポンス自体をagent相当として読むフォールバックを追加(入れ子形
  が優先される点は変えない)。
- `isCursorAgentSuccessfulTerminal`: `IDLE`も成功終端に追加。
- `src/views/cursorAgent.ts`: クライアント側の`TERMINAL_AGENT_STATUSES`にも
  `IDLE`を追加(無いと`/cursor-agent`ページが完了済みAgentに対しても
  開くたびに無駄にCursor APIへ問い合わせ続け、ユーザーが懸念していた
  課金増加の別の原因になっていた)。バッジ色も`IDLE`を緑(完了)扱いに変更。

## 教訓

- 「AIチャットでは読めるのにCursorOpsでは読めない」という報告を受けたとき、
  最初は `report_text` vs `cached_answer_text` の取り違え(#1810で対処)だと
  判断したが、それを直しても再現した。**キャッシュテーブルの実データ件数
  (`COUNT(*)`)を先に見れば、それが「特定行の読み違え」ではなく
  「そもそもキャッシュへの書き込みが一度も成功していない」問題だと
  もっと早く判断できた**。ルール10・12(D1の実データを最初に見る/推測で
  修正しない)の重要性を再確認した事例。
- 「その時点のDBの状態」を信頼して判定を行うAPI(`isCursorAgentSuccessfulTerminal`
  の呼び出し元)は、そのDBの状態が別経路で更新されなければ永遠に古いまま
  になりうる、という一般的な落とし穴。更新経路が1つしかない値を別のAPIが
  読むだけの用途で使う場合、その値がいつ最後に更新されたか(鮮度)を
  意識する必要がある。
- **同じCursor APIでも、エンドポイントが違えばレスポンス形が全く違う**
  (起動: `{agent:{...}, run:{...}}`の入れ子。ステータス確認: `agent`ラップ
  無しのフラット)。片方のエンドポイントの実データで確認した抽出関数を、
  検証せずもう片方のエンドポイントにも使い回すと、今回のように「動いては
  いるが結果が常にnull」という気づきにくい壊れ方をする。新しいエンドポイントを
  使うときは、そのエンドポイント自身の生レスポンスを一度実データで確認する
  こと。
- ユーザーからの「キャッシュされていない事実そのものを先に問題にしろ、
  未キャッシュだからと言ってAPIを叩き直す対応(課金増加のリスク)を
  安易に追加するな」という指摘が、結果的に正しい優先順位だった。原因不明の
  まま対症療法(ライブ再取得ボタン)を追加していたら、真の原因(レスポンス
  形の誤認識)を見逃したまま無駄なAPI呼び出しを増やすだけに終わっていた。
