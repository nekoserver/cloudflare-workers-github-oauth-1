CREATE TABLE IF NOT EXISTS ai_summary_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  daily_seq INTEGER NOT NULL,
  event_date TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'pr_summary',
  repo_full_name TEXT,
  pr_number INTEGER,
  pr_action TEXT,
  pr_url TEXT,
  model TEXT,
  summary TEXT,
  diff_length INTEGER DEFAULT 0,
  slack_notified INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_summary_log_date ON ai_summary_log (event_date);
