-- Current release and installation status for each package shown by /cf-containers.
CREATE TABLE IF NOT EXISTS cf_container_package_release_status (
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
  checked_at TEXT NOT NULL,
  PRIMARY KEY(container_key, package_name)
);
CREATE INDEX IF NOT EXISTS idx_cf_container_package_release_status_checked
  ON cf_container_package_release_status(checked_at);
