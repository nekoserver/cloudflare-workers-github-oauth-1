CREATE TABLE IF NOT EXISTS rail_station_nearby_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_name TEXT NOT NULL,
  point_type TEXT NOT NULL,
  point_name TEXT NOT NULL,
  point_lat REAL NOT NULL,
  point_lon REAL NOT NULL,
  distance_km REAL NOT NULL,
  fetched_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rail_station_nearby_points_unique ON rail_station_nearby_points(station_name, point_type, point_name);
CREATE INDEX IF NOT EXISTS idx_rail_station_nearby_points_station ON rail_station_nearby_points(station_name);

CREATE TABLE IF NOT EXISTS rail_station_nearby_fetched (
  station_name TEXT PRIMARY KEY,
  fetched_at TEXT DEFAULT (datetime('now')),
  point_count INTEGER DEFAULT 0
);
