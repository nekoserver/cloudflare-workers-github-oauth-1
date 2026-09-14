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
`GET /api/cursor-agent/history/:id/conversation` に対して実施する
(このNOTICE作成時点ではまだ実装中。実装後にコミットハッシュを追記する)。

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
