CREATE TABLE IF NOT EXISTS cursor_agent_search_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  launch_id INTEGER NOT NULL REFERENCES cursor_agent_launch_log(id),
  first_searched_at TEXT NOT NULL,
  last_searched_at TEXT NOT NULL,
  select_count INTEGER NOT NULL DEFAULT 1,
  result_count INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cursor_agent_search_log_unique ON cursor_agent_search_log(user_id, keyword, launch_id);
CREATE INDEX IF NOT EXISTS idx_cursor_agent_search_log_user ON cursor_agent_search_log(user_id, last_searched_at);
CREATE INDEX IF NOT EXISTS idx_cursor_agent_search_log_launch ON cursor_agent_search_log(launch_id);
CREATE TABLE IF NOT EXISTS cursor_agent_search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  launch_id INTEGER NOT NULL REFERENCES cursor_agent_launch_log(id),
  seq_num INTEGER NOT NULL,
  searched_at TEXT NOT NULL,
  result_count INTEGER
);
CREATE INDEX IF NOT EXISTS idx_cursor_agent_search_history_lookup ON cursor_agent_search_history(user_id, keyword, launch_id);
CREATE INDEX IF NOT EXISTS idx_cursor_agent_search_history_user ON cursor_agent_search_history(user_id, searched_at);
CREATE INDEX IF NOT EXISTS idx_cursor_agent_search_history_launch ON cursor_agent_search_history(launch_id);
