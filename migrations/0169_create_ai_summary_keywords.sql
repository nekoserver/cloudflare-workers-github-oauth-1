CREATE TABLE IF NOT EXISTS ai_summary_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  summary_log_id INTEGER NOT NULL REFERENCES ai_summary_log(id),
  keyword TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(summary_log_id, keyword)
);
CREATE INDEX IF NOT EXISTS idx_ai_summary_keywords_summary_log_id ON ai_summary_keywords(summary_log_id);
