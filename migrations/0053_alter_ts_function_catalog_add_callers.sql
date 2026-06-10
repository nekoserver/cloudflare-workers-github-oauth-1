ALTER TABLE ts_function_catalog ADD COLUMN start_line INTEGER;
ALTER TABLE ts_function_catalog ADD COLUMN end_line INTEGER;
CREATE TABLE IF NOT EXISTS ts_function_callers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id     INTEGER NOT NULL REFERENCES ts_repository(id),
  callee_id   INTEGER NOT NULL REFERENCES ts_function_catalog(id),
  caller_file TEXT NOT NULL,
  caller_line INTEGER NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(callee_id, caller_file, caller_line)
);
CREATE INDEX IF NOT EXISTS idx_tfcr_callee ON ts_function_callers(callee_id);
CREATE INDEX IF NOT EXISTS idx_tfcr_file   ON ts_function_callers(repo_id, caller_file);
