CREATE TABLE IF NOT EXISTS commit_summary_cache (
  commit_hash TEXT PRIMARY KEY,
  repo_name TEXT NOT NULL,
  summary TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_commit_summary_cache_repo ON commit_summary_cache(repo_name);
