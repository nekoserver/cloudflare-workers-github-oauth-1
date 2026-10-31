CREATE TABLE IF NOT EXISTS cf_container_build_cache_effects (
  snapshot_key TEXT NOT NULL REFERENCES cf_container_build_measurements(snapshot_key),
  build_uuid TEXT NOT NULL,
  package_name TEXT NOT NULL,
  version TEXT NOT NULL,
  compile_seconds REAL NOT NULL CHECK(compile_seconds >= 0),
  install_seconds REAL NOT NULL CHECK(install_seconds >= 0),
  saved_seconds REAL NOT NULL,
  source_bytes INTEGER CHECK(source_bytes IS NULL OR source_bytes >= 0),
  package_bytes INTEGER CHECK(package_bytes IS NULL OR package_bytes >= 0),
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(snapshot_key, package_name)
);
CREATE INDEX IF NOT EXISTS idx_cf_container_build_cache_effects_package ON cf_container_build_cache_effects(package_name, recorded_at DESC);
