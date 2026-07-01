CREATE TABLE IF NOT EXISTS rail_station_cities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_name TEXT NOT NULL,
  city_name TEXT NOT NULL,
  city_lat REAL NOT NULL,
  city_lon REAL NOT NULL,
  population INTEGER,
  distance_km REAL NOT NULL,
  country_code TEXT,
  fetched_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rail_station_cities_unique ON rail_station_cities(station_name, city_name);
CREATE INDEX IF NOT EXISTS idx_rail_station_cities_name ON rail_station_cities(station_name);

CREATE TABLE IF NOT EXISTS rail_station_fetched (
  station_name TEXT PRIMARY KEY,
  fetched_at TEXT DEFAULT (datetime('now')),
  city_count INTEGER DEFAULT 0
);
