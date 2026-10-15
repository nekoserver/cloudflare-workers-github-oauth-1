CREATE TABLE IF NOT EXISTS tree_view_keyword_search_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  query TEXT NOT NULL,
  file_count INTEGER NOT NULL DEFAULT 0,
  searched_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tvksl_user_repo_query ON tree_view_keyword_search_log(user_id, repo_name, query, searched_at);

CREATE TABLE IF NOT EXISTS tree_view_keyword_search_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  search_log_id INTEGER NOT NULL REFERENCES tree_view_keyword_search_log(id),
  keyword TEXT NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tvksr_search_log_id ON tree_view_keyword_search_results(search_log_id);
CREATE INDEX IF NOT EXISTS idx_tvksr_keyword ON tree_view_keyword_search_results(keyword);
