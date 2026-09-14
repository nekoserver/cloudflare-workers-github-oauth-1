# SPEC.cloudflare-workers-github-oauth-1.20260914

## 1. 回答キャッシュ表欠落時は画面の列で検索を継続する

**対象**: `GET /api/cursor-agent/history?q=`、`POST /api/cursor-agent/history/past-log-search`、
`queryCursorAgentHistoryWithSearch`、`/cursor-agent` 問答履歴のインクリメンタル検索 —
migration 0140（過去ログ表）を適用しても `cursor_agent_answer_cache`（0139）が無いと
`LEFT JOIN` が落ち、検索語付きの問い合わせが空行だけになってインクリメンタル検索が死ぬ。
診断用 `searchError` は残したまま、プロンプト・レポート・Agent ID・リポジトリだけで再検索する。

### 背景

本番で 0140 を適用してページをリロードしても、次の文言が残る。

```text
回答キャッシュの検索に失敗しました: D1_ERROR: no such table: cursor_agent_answer_cache: SQLITE_ERROR
```

0140 は `cursor_agent_search_log` / `cursor_agent_search_history` を作るだけで、
このエラーの表は 0139 である。加えて、`q=` 付き SQL がキャッシュ表を JOIN するため、
表が無いとヒット0件になり、入力しても一覧が空のままになる。
「解除」は検索語なし一覧へ戻すためのボタンだったが、`type=search` を空にすれば
`input` で同じ復帰ができるため、謎の操作に見えていた。

### 故障シナリオ

| # | 故障 | 対処 |
|---|---|---|
| 1 | 0140 だけ適用し 0139 が無い | JOIN 失敗を `searchError` に残し、画面の列で再検索する |
| 2 | 再検索まで空行にする | プロンプト等に一致する行は `rows` に載せる |
| 3 | `searchError` を消して空成功にする | 本番文言を残し、未作成とキャッシュ0件を区別する |
| 4 | 解除ボタンだけが一覧復帰手段 | ボタンを撤去し、検索欄を空にすると全件に戻す |

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/utils/cursorAgentLaunch.ts` | 欠落判定・JOINなしSQL・`queryCursorAgentHistoryWithSearch` |
| `src/index.ts` | GET 履歴と過去ログ検索が同じフォールバックを使う |
| `src/views/cursorAgent.ts` | 「解除」撤去。`searchError` とヒット行を同時表示 |

回答キャッシュ本文まで探すには、次の SQL を D1 で実行する（migration 0139）。

```sql
CREATE TABLE IF NOT EXISTS cursor_agent_answer_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  launch_id INTEGER NOT NULL UNIQUE REFERENCES cursor_agent_launch_log(id),
  answer_text TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cursor_agent_answer_cache_launch ON cursor_agent_answer_cache(launch_id);
```

### テスト

- `src/cursor-agent-launch.test.ts`: `q=anything` は空行+`searchError`。`q=表なし` は行+`searchError`
- `src/cursor-agent-past-log-search.test.ts`: キャッシュ表なしでもプロンプト一致を保存
- `src/cursor-agent-history-answer-search-e2e.test.ts`: エラーと行の同時表示、検索欄クリアで全件復帰

### 関連コミット

- [`afc8f75`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/afc8f75) 回答キャッシュ表欠落時も画面の列で検索し解除ボタンを撤去する

### 関連

- [`SPEC.cursor-agent.md`](SPEC.cursor-agent.md)
- [`NOTICE.cloudflare-workers-github-oauth-1.20260914.md`](NOTICE.cloudflare-workers-github-oauth-1.20260914.md)
