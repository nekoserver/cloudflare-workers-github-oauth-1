CREATE TABLE IF NOT EXISTS cursor_agent_launch_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  repo_full_name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  agent_id TEXT,
  cursor_response TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cursor_agent_launch_log_user_created ON cursor_agent_launch_log(user_id, created_at);
