CREATE TABLE IF NOT EXISTS cf_container_package_release_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  container_key TEXT NOT NULL,
  package_name TEXT NOT NULL,
  installed_version TEXT,
  installed_status TEXT NOT NULL CHECK(installed_status IN ('installed','not_detected','not_recorded','no_snapshot')),
  latest_version TEXT,
  latest_release_at TEXT,
  current_release_at TEXT,
  release_status TEXT NOT NULL CHECK(release_status IN ('available','failed','unsupported')),
  update_status TEXT NOT NULL CHECK(update_status IN ('update_available','current_or_ahead','latest_unavailable','unsupported','not_detected','unknown')),
  source TEXT,
  error TEXT,
  installed_snapshot_id INTEGER REFERENCES cf_container_snapshots(id),
  installed_snapshot_at TEXT,
  trigger_kind TEXT NOT NULL CHECK(trigger_kind IN ('health_check','page_load')),
  checked_at TEXT NOT NULL,
  UNIQUE(container_key, package_name, checked_at, trigger_kind)
);
CREATE INDEX IF NOT EXISTS idx_cf_container_package_release_history_package
  ON cf_container_package_release_history(container_key, package_name, checked_at);
CREATE INDEX IF NOT EXISTS idx_cf_container_package_release_history_checked
  ON cf_container_package_release_history(checked_at);
