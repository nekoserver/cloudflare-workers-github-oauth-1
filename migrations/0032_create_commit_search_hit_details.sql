CREATE TABLE IF NOT EXISTS commit_search_hit_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  search_history_id INTEGER NOT NULL,
  repo_name TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  commit_message TEXT NOT NULL,
  FOREIGN KEY (search_history_id) REFERENCES commit_search_history(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_commit_search_hit_details_history ON commit_search_hit_details(search_history_id);
CREATE INDEX IF NOT EXISTS idx_commit_search_hit_details_repo ON commit_search_hit_details(repo_name);
CREATE INDEX IF NOT EXISTS idx_commit_search_hit_details_sha ON commit_search_hit_details(commit_sha);
