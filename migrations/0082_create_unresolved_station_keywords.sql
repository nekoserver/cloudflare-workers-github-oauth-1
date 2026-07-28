CREATE TABLE IF NOT EXISTS unresolved_station_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_name TEXT NOT NULL,
  recorded_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unresolved_station_keywords_unique ON unresolved_station_keywords(station_name);
