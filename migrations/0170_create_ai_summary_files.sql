CREATE TABLE IF NOT EXISTS ai_summary_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  summary_log_id INTEGER NOT NULL REFERENCES ai_summary_log(id),
  file_path TEXT NOT NULL,
  file_ext TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(summary_log_id, file_path)
);
CREATE INDEX IF NOT EXISTS idx_ai_summary_files_summary_log_id ON ai_summary_files(summary_log_id);
CREATE INDEX IF NOT EXISTS idx_ai_summary_files_file_ext ON ai_summary_files(file_ext);
