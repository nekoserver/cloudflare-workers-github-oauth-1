CREATE TABLE IF NOT EXISTS moondream_analyze_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_length INTEGER NOT NULL,
  image_bytes INTEGER NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_moondream_analyze_log_user_created ON moondream_analyze_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moondream_analyze_log_status ON moondream_analyze_log(status);
