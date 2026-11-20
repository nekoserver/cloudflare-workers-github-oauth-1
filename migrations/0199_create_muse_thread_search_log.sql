CREATE TABLE IF NOT EXISTS muse_thread_search_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  search_key TEXT NOT NULL CHECK (length(trim(search_key)) > 0 AND length(search_key) <= 500),
  hit_count INTEGER NOT NULL CHECK (typeof(hit_count) = 'integer' AND hit_count >= 0),
  thread_ids TEXT NOT NULL,
  searched_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_muse_thread_search_log_user_id
  ON muse_thread_search_log(user_id, id DESC);
