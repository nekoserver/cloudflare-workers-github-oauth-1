CREATE TABLE IF NOT EXISTS heritage_cities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  heritage_name TEXT NOT NULL,
  city_name TEXT NOT NULL,
  city_lat REAL NOT NULL,
  city_lon REAL NOT NULL,
  population INTEGER,
  distance_km REAL NOT NULL,
  fetched_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_heritage_cities_unique ON heritage_cities(heritage_name, city_name);
CREATE INDEX IF NOT EXISTS idx_heritage_cities_name ON heritage_cities(heritage_name);

CREATE TABLE IF NOT EXISTS heritage_city_fetched (
  heritage_name TEXT PRIMARY KEY,
  fetched_at TEXT DEFAULT (datetime('now')),
  city_count INTEGER DEFAULT 0
);
