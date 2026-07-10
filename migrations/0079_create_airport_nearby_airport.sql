CREATE TABLE IF NOT EXISTS airport_nearby_airport (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  airport_name TEXT NOT NULL,
  other_airport_name TEXT NOT NULL,
  distance_km REAL NOT NULL,
  recorded_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_airport_nearby_airport_unique ON airport_nearby_airport(airport_name, other_airport_name);
CREATE INDEX IF NOT EXISTS idx_airport_nearby_airport_airport ON airport_nearby_airport(airport_name);
