CREATE TABLE IF NOT EXISTS commit_file_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_name TEXT NOT NULL,
  commit_hash TEXT NOT NULL,
  file_path TEXT NOT NULL,
  committed_at TEXT NOT NULL,
  UNIQUE(repo_name, commit_hash, file_path)
);
CREATE INDEX IF NOT EXISTS idx_commit_file_changes_repo_file ON commit_file_changes(repo_name, file_path);
CREATE INDEX IF NOT EXISTS idx_commit_file_changes_commit ON commit_file_changes(repo_name, commit_hash);
