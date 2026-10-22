-- Existing rows have no trusted container identity; do not guess or backfill it.
ALTER TABLE cf_container_operation_log ADD COLUMN container_key TEXT;
ALTER TABLE cf_container_operation_log ADD COLUMN container_label TEXT;
ALTER TABLE cf_container_operation_log ADD COLUMN hourly_rate_usd REAL CHECK(hourly_rate_usd IS NULL OR hourly_rate_usd >= 0);
ALTER TABLE cf_container_operation_log ADD COLUMN cost_basis_json TEXT CHECK(cost_basis_json IS NULL OR json_valid(cost_basis_json));
CREATE INDEX IF NOT EXISTS idx_container_operation_identity_time ON cf_container_operation_log(container_key,created_at,id);

CREATE TABLE IF NOT EXISTS cf_container_session_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_operation_id INTEGER NOT NULL REFERENCES cf_container_operation_log(id),
  revision INTEGER NOT NULL CHECK(revision > 0),
  content TEXT NOT NULL CHECK(length(content) <= 8000),
  recorded_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(start_operation_id, revision)
);
