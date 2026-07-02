CREATE TABLE IF NOT EXISTS rail_line_stations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  line_name TEXT NOT NULL,
  line_flag TEXT NOT NULL,
  line_country TEXT NOT NULL,
  station_name TEXT NOT NULL,
  station_order INTEGER NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  station_country TEXT NOT NULL,
  station_flag TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rail_line_stations_line_order ON rail_line_stations(line_name, station_order);
CREATE INDEX IF NOT EXISTS idx_rail_line_stations_line_name ON rail_line_stations(line_name);
CREATE INDEX IF NOT EXISTS idx_rail_line_stations_country ON rail_line_stations(station_country);
