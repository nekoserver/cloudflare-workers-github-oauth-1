CREATE TABLE IF NOT EXISTS cf_container_image_records (
  record_hash TEXT PRIMARY KEY,
  build_uuid TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('build-timing','runtime-analysis','image-manifest')),
  measured_at TEXT,
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  record_json TEXT NOT NULL CHECK(json_valid(record_json))
);
CREATE INDEX IF NOT EXISTS idx_container_image_records_build
  ON cf_container_image_records(build_uuid,kind,measured_at DESC);
