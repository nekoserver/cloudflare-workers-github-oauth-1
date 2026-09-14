# NOTICE.cloudflare-workers-github-oauth-1.20260914

## /cursor-agent の履歴検索は回答キャッシュ本文だけを見る

**対象**: `GET /cursor-agent` の検索窓と `GET /api/cursor-agent/history?q=`。

画面に見えているプロンプト・リポジトリ・レポート・Agent IDでは探せない。
検索語は `cursor_agent_answer_cache.answer_text` に対する部分一致
(大文字小文字はASCIIのみ無視)になる。

回答キャッシュは Agent ID をタップして会話API(または既存キャッシュ)を
読んだあとに1行入る。一度もモーダルを開いていない起動は、プロンプトに
同じ語があってもヒットしない。

キャッシュ表(migration 0139)が未作成のまま検索すると、空の成功ではなく
`searchError` が返り、履歴欄に失敗理由が出る。
