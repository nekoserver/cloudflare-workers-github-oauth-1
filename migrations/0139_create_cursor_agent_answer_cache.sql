CREATE TABLE IF NOT EXISTS cursor_agent_answer_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  launch_id INTEGER NOT NULL UNIQUE REFERENCES cursor_agent_launch_log(id),
  answer_text TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cursor_agent_answer_cache_launch ON cursor_agent_answer_cache(launch_id);
