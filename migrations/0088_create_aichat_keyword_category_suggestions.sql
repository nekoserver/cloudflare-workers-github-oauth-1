CREATE TABLE IF NOT EXISTS aichat_keyword_category_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  suggested_category_id INTEGER NOT NULL REFERENCES aichat_keyword_categories(id),
  similarity REAL NOT NULL,
  model TEXT NOT NULL,
  accepted INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_aichat_keyword_category_suggestions_user_keyword ON aichat_keyword_category_suggestions(user_id, keyword, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aichat_keyword_category_suggestions_category ON aichat_keyword_category_suggestions(suggested_category_id);
