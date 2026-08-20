CREATE TABLE IF NOT EXISTS heritage_journey_waypoint_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_city_name TEXT NOT NULL,
  start_lat REAL NOT NULL,
  start_lon REAL NOT NULL,
  end_city_name TEXT NOT NULL,
  end_lat REAL NOT NULL,
  end_lon REAL NOT NULL,
  waypoint_count INTEGER NOT NULL,
  waypoint_heritage_ids TEXT NOT NULL,
  total_distance_km REAL NOT NULL,
  template_flag INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_flag INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_heritage_journey_waypoint_sets_dedup ON heritage_journey_waypoint_sets(start_city_name, end_city_name, waypoint_heritage_ids);
