CREATE TABLE IF NOT EXISTS jev_keyword_evaluation_locks (
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  locked_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, keyword)
);
