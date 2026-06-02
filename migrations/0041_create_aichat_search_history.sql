CREATE TABLE IF NOT EXISTS aichat_search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  share_id TEXT NOT NULL,
  seq_num INTEGER NOT NULL,
  searched_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_aichat_search_history_lookup ON aichat_search_history(user_id, keyword, share_id);
CREATE INDEX IF NOT EXISTS idx_aichat_search_history_user ON aichat_search_history(user_id, searched_at);
