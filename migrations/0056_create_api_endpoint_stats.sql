CREATE TABLE IF NOT EXISTS api_endpoint_stats (
  endpoint TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 0,
  count INTEGER NOT NULL DEFAULT 1,
  last_called_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (endpoint, status_code)
);
CREATE INDEX IF NOT EXISTS idx_api_endpoint_stats_endpoint ON api_endpoint_stats(endpoint);
