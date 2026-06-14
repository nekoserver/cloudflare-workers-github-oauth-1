CREATE TABLE IF NOT EXISTS aichat_rate_limit (
  user_id TEXT NOT NULL,
  window_key TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, window_key)
);
CREATE INDEX IF NOT EXISTS idx_aichat_rl_window ON aichat_rate_limit(window_key);
