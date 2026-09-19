CREATE TABLE IF NOT EXISTS tree_view_snapshots (
  repo_name TEXT PRIMARY KEY,
  tree_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tree_view_snapshots_updated ON tree_view_snapshots(updated_at);

CREATE TABLE IF NOT EXISTS tree_view_snapshot_refresh_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  requested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tree_view_snapshot_refresh_log_user ON tree_view_snapshot_refresh_log(user_id, requested_at);
