-- Migration 0056より前に作られたDBや、migration履歴だけが移送されたDBでも
-- sqlx-d1の統計クエリが失敗しないよう、実テーブルを冪等に再確認する。
CREATE TABLE IF NOT EXISTS api_endpoint_stats (
  endpoint TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 0,
  count INTEGER NOT NULL DEFAULT 1,
  last_called_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (endpoint, status_code)
);

CREATE INDEX IF NOT EXISTS idx_api_endpoint_stats_endpoint
  ON api_endpoint_stats(endpoint);
