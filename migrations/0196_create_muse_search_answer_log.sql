CREATE TABLE IF NOT EXISTS muse_search_answer_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  search_key TEXT NOT NULL CHECK (length(trim(search_key)) > 0 AND length(search_key) <= 500),
  answer_id TEXT NOT NULL CHECK (length(trim(answer_id)) > 0),
  chat_id TEXT NOT NULL CHECK (length(trim(chat_id)) > 0),
  thread_id TEXT CHECK (thread_id IS NULL OR length(trim(thread_id)) > 0),
  occurrences INTEGER NOT NULL CHECK (typeof(occurrences) = 'integer' AND occurrences >= 1),
  preview TEXT NOT NULL,
  answer_created_at INTEGER NOT NULL CHECK (typeof(answer_created_at) = 'integer'),
  searched_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_muse_search_answer_log_user_answer_key
  ON muse_search_answer_log(user_id, answer_id, search_key, id DESC);
