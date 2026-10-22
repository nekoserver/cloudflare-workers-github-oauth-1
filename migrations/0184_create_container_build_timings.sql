-- Immutable observations: concurrent/partial fetches cannot overwrite a completed measurement.
CREATE TABLE IF NOT EXISTS cf_container_build_measurements (
  snapshot_key TEXT PRIMARY KEY,
  build_uuid TEXT NOT NULL,
  build_created_on TEXT,
  build_status TEXT,
  log_complete INTEGER NOT NULL CHECK(log_complete IN (0,1)),
  step_count INTEGER NOT NULL,
  terminal_count INTEGER NOT NULL,
  collected_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  parser_version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_container_build_measurements_build
  ON cf_container_build_measurements(build_uuid, terminal_count DESC, step_count DESC);
CREATE TABLE IF NOT EXISTS cf_container_build_steps (
  snapshot_key TEXT NOT NULL REFERENCES cf_container_build_measurements(snapshot_key),
  step_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('running','done','cached','error','canceled')),
  seconds REAL CHECK(seconds IS NULL OR seconds >= 0),
  PRIMARY KEY(snapshot_key, step_id)
);
