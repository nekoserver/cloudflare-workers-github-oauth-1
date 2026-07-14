CREATE TABLE IF NOT EXISTS unresolved_castle_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  castle_name TEXT NOT NULL,
  recorded_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unresolved_castle_keywords_unique ON unresolved_castle_keywords(castle_name);
