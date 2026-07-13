CREATE TABLE IF NOT EXISTS unresolved_airport_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  airport_name TEXT NOT NULL,
  recorded_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unresolved_airport_keywords_unique ON unresolved_airport_keywords(airport_name);
