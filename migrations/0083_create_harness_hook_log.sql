CREATE TABLE IF NOT EXISTS harness_hook_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hook_event TEXT NOT NULL,
  check_name TEXT NOT NULL,
  tool_name TEXT,
  file_path TEXT,
  result TEXT NOT NULL,
  detail TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_harness_hook_log_created ON harness_hook_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_harness_hook_log_result ON harness_hook_log(result, created_at DESC);
