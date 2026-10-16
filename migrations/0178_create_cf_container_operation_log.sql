CREATE TABLE IF NOT EXISTS cf_container_operation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  result TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cf_container_operation_log_created_at ON cf_container_operation_log(created_at);
