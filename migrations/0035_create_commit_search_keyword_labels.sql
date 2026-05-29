CREATE TABLE IF NOT EXISTS commit_search_keyword_labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  search_query TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'uncategorized',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, search_query)
);
CREATE INDEX IF NOT EXISTS idx_commit_search_keyword_labels_user ON commit_search_keyword_labels(user_id);
CREATE INDEX IF NOT EXISTS idx_commit_search_keyword_labels_label ON commit_search_keyword_labels(user_id, label);
