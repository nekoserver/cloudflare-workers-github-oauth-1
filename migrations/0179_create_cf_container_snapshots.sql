CREATE TABLE IF NOT EXISTS cf_container_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  prev_snapshot_id INTEGER,
  running_containers INTEGER,
  connected_seconds INTEGER,
  estimated_cost_usd REAL,
  image_commit TEXT,
  versions_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (prev_snapshot_id) REFERENCES cf_container_snapshots(id)
);
CREATE INDEX IF NOT EXISTS idx_cf_container_snapshots_user_created ON cf_container_snapshots(user_id, created_at);
CREATE TABLE IF NOT EXISTS cf_container_snapshot_diffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL,
  metric TEXT NOT NULL,
  before_value TEXT,
  after_value TEXT,
  delta REAL,
  FOREIGN KEY (snapshot_id) REFERENCES cf_container_snapshots(id)
);
CREATE INDEX IF NOT EXISTS idx_cf_container_snapshot_diffs_snapshot ON cf_container_snapshot_diffs(snapshot_id);
ALTER TABLE notification_settings ADD COLUMN cf_containers_report_slack INTEGER NOT NULL DEFAULT 1;
