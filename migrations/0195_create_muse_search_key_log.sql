CREATE TABLE IF NOT EXISTS muse_search_key_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  search_key TEXT NOT NULL CHECK (length(trim(search_key)) > 0 AND length(search_key) <= 500),
  ai_chat_count INTEGER NOT NULL CHECK (typeof(ai_chat_count) = 'integer' AND ai_chat_count >= 0),
  tree_view_count INTEGER CHECK (tree_view_count IS NULL OR (typeof(tree_view_count) = 'integer' AND tree_view_count >= 0)),
  searched_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_muse_search_key_log_user_key
  ON muse_search_key_log(user_id, search_key, id DESC);
