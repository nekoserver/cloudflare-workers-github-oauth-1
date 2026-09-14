# NOTICE.cloudflare-workers-github-oauth-1.20260914

## /cursor-agent の履歴検索はサーバ側で回答と画面の列を見る

**対象**: `GET /cursor-agent` の検索窓と `GET /api/cursor-agent/history?q=`。

検索語は回答キャッシュ本文に加え、プロンプト・レポート・Agent ID・リポジトリも
サーバ側で部分一致する。キャッシュ未作成の行でも、画面に見えている列の語では
ヒットする。入力途中は 300ms デバウンスのインクリメンタル検索で一覧が絞り込まれる。
ページ初期読み込みの一覧取得が遅れて返っても、世代番号と Abort で検索結果を上書きしない。

「検索」と Enter は表示用の問い合わせだけ。キーワードとヒットした起動履歴を
D1 へ結ぶのは「過去ログ検索」ボタン（`POST /api/cursor-agent/history/past-log-search`）。
AIチャットの `aichat_search_log` と同じく `(user_id, keyword, launch_id)` が一意。

一覧へ戻す操作は検索欄を空にすること。`type=search` のクリアで `input` が走り、
`q` なしの最新100件に戻る。「解除」ボタンは置かない（何を解除するのか分からず、
空欄化と同じだから）。問答履歴見出しの再読み込みボタンも置かない。

回答キャッシュ本文で探す場合、完了済みで Agent ID を一度開いた行が対象。
RUNNING 中の途中回答はキャッシュしない。

キャッシュ表(migration 0139)が未作成、または表が落ちて SQLite が同じエラーを返すと、
空の成功ではなく `searchError` が返り、履歴欄に失敗理由が出る。
**migration 0140 を適用してもこのエラーは消えない。** 0140 は過去ログ表であり、
欠落しているのは `cursor_agent_answer_cache` である。
インクリメンタル検索は画面の列（プロンプト・レポート・Agent ID・リポジトリ）で
継続し、回答本文ヒットだけが 0139 適用後に有効になる。
本番 D1 の文言は次のとおり。データ破損時とテーブル未設定時のテストに使う。
[`SPEC.cursor-agent.md`](SPEC.cursor-agent.md) へまとめるときも残す。
起動から検索までの現状と、AIチャット入力窓・ダイナミックワーカー対応の到達点は
[`SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md`](SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md)。

```text
回答キャッシュの検索に失敗しました: D1_ERROR: no such table: cursor_agent_answer_cache: SQLITE_ERROR
```

過去ログ表(migration 0140)が未作成のまま「過去ログ検索」すると、ヒット一覧は返しつつ
`persistError` が出る。

## cursor-agent の次工程は AIチャット入力窓とダイナミックワーカー

**対象**: `/aichat` 入力窓と `nekoserver/dynamicneko`。

`/cursor-agent` 単体では起動・チャンク結合・キャッシュ・応答検索・過去ログ検索まで
できた。入力窓の `/neko search` は `ai_chat_shares` であり Cursor VM 履歴とは別物。
表示検索はスラッシュコマンド `/neko csearch` で入力窓からできるようになった（0140 へは書かない）。
起動と過去ログ保存、およびダイナミックワーカー経路は未着手。
dynamicneko は Cookie セッションが無いので、aichat/kimi-code の `-external` と同じく
Bearer secret + Service Binding が必要。launch の `user_id` を
`dynamicneko-service` にすると本体ページの履歴と分裂する。詳細は
[`SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md`](SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md) 節7・節8。

## `/neko csearch` は Cursor VM 履歴の表示検索であり `/neko search` と混ぜない

**対象**: AIチャット入力窓のスラッシュコマンド `/neko csearch <キーワード>`。システムコマンドではない。

`/neko search` / `/neko s` は `ai_chat_shares`（AIチャットの質問・回答）を見る。
`/neko csearch` は `cursor_agent_launch_log` と回答キャッシュ（courts / Cursor VM の過去ログ）を見る。
同じキーワードでもヒット集合は一致しない。

`csearch` は `queryCursorAgentHistoryWithSearch` の表示検索であり、
0140 の `cursor_agent_search_log` / `cursor_agent_search_history` には書かない。
回答全文はチャット本文に出さず、表の「回答全文」から `#cursorAgentAnswerModal` を開き、
`GET /api/cursor-agent/history/:id/conversation` をキャッシュ優先で読む。
0139 未適用だと本文検索は画面列フォールバックになり、会話取得もキャッシュを読めない。
