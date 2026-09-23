CREATE TABLE IF NOT EXISTS aichat_auto_explore_history (
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  last_explored_at TEXT NOT NULL,
  PRIMARY KEY (user_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_aichat_auto_explore_history_recent
  ON aichat_auto_explore_history(user_id, last_explored_at DESC);
