CREATE TABLE IF NOT EXISTS alt_notify_ingest_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  channel TEXT,
  text TEXT NOT NULL,
  blocks_json TEXT,
  thread_ts TEXT,
  linked_request_id TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_alt_notify_ingest_log_received_at ON alt_notify_ingest_log(received_at);
CREATE INDEX IF NOT EXISTS idx_alt_notify_ingest_log_linked_request_id ON alt_notify_ingest_log(linked_request_id);
