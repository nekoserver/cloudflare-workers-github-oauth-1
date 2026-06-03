CREATE TABLE IF NOT EXISTS aichat_share_subquery_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  question TEXT NOT NULL,
  subquery_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, question, subquery_id)
);
