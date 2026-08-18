CREATE TABLE IF NOT EXISTS ts_file_dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL,
  source_file TEXT NOT NULL,
  target_file TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ts_file_dependencies_edge ON ts_file_dependencies(repo_id, source_file, target_file);
CREATE INDEX IF NOT EXISTS idx_ts_file_dependencies_source ON ts_file_dependencies(repo_id, source_file);
CREATE INDEX IF NOT EXISTS idx_ts_file_dependencies_target ON ts_file_dependencies(repo_id, target_file);
