CREATE TABLE IF NOT EXISTS heritage_journey_registered_routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_city TEXT NOT NULL,
  end_city TEXT NOT NULL,
  straight_km REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_heritage_journey_registered_routes_pair ON heritage_journey_registered_routes(start_city, end_city);
