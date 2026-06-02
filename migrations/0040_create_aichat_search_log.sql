CREATE TABLE IF NOT EXISTS aichat_search_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  share_id TEXT NOT NULL,
  first_searched_at TEXT NOT NULL,
  last_searched_at TEXT NOT NULL,
  select_count INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_aichat_search_log_unique ON aichat_search_log(user_id, keyword, share_id);
