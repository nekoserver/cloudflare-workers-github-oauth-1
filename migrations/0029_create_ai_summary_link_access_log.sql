CREATE TABLE IF NOT EXISTS ai_summary_link_access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route TEXT NOT NULL,
  request_id TEXT NOT NULL,
  found INTEGER NOT NULL DEFAULT 0,
  issue_code TEXT NOT NULL DEFAULT 'unknown',
  issue_detail TEXT,
  referer TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_summary_link_access_log_request ON ai_summary_link_access_log(request_id);
CREATE INDEX IF NOT EXISTS idx_ai_summary_link_access_log_created ON ai_summary_link_access_log(created_at);
