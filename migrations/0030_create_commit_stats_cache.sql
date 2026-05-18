CREATE TABLE IF NOT EXISTS commit_stats_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  period TEXT NOT NULL,
  author_login TEXT NOT NULL,
  author_name TEXT,
  commit_count INTEGER NOT NULL DEFAULT 0,
  merge_count INTEGER NOT NULL DEFAULT 0,
  cached_at TEXT NOT NULL,
  UNIQUE(owner, repo, period, author_login)
);

CREATE INDEX IF NOT EXISTS idx_commit_stats_cache_repo_period ON commit_stats_cache(owner, repo, period);
