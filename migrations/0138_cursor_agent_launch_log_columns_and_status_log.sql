ALTER TABLE cursor_agent_launch_log ADD COLUMN agent_name TEXT;
ALTER TABLE cursor_agent_launch_log ADD COLUMN agent_url TEXT;
CREATE TABLE IF NOT EXISTS cursor_agent_status_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  launch_id INTEGER NOT NULL REFERENCES cursor_agent_launch_log(id),
  agent_status TEXT,
  run_status TEXT,
  report_text TEXT,
  raw_response TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cursor_agent_status_log_launch ON cursor_agent_status_log(launch_id, fetched_at);
