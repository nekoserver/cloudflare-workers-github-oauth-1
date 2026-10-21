CREATE TABLE IF NOT EXISTS cf_container_firewall_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  container_name TEXT NOT NULL,
  hour_utc TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  available INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  UNIQUE(container_name, hour_utc)
);
CREATE INDEX IF NOT EXISTS idx_firewall_snapshots_time
  ON cf_container_firewall_snapshots(collected_at);
