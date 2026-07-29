CREATE TABLE IF NOT EXISTS aichat_keyword_category_map (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES aichat_keyword_categories(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aichat_keyword_category_map_unique ON aichat_keyword_category_map(user_id, keyword, category_id);
CREATE INDEX IF NOT EXISTS idx_aichat_keyword_category_map_category ON aichat_keyword_category_map(category_id);
