CREATE TABLE IF NOT EXISTS aichat_search_impressions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  share_id TEXT NOT NULL,
  result_count INTEGER,
  searched_at TEXT NOT NULL,
  deleted_at TEXT
);
