CREATE TABLE IF NOT EXISTS airport_nearby_heritage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  airport_name TEXT NOT NULL,
  heritage_name TEXT NOT NULL,
  distance_km REAL NOT NULL,
  recorded_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_airport_nearby_heritage_unique ON airport_nearby_heritage(airport_name, heritage_name);
CREATE INDEX IF NOT EXISTS idx_airport_nearby_heritage_airport ON airport_nearby_heritage(airport_name);
