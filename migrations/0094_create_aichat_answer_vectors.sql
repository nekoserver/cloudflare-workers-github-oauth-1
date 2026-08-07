CREATE TABLE IF NOT EXISTS aichat_answer_vectors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  model TEXT NOT NULL,
  dim INTEGER NOT NULL,
  vector BLOB NOT NULL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aichat_answer_vectors_unique ON aichat_answer_vectors(user_id, share_id, model);
CREATE INDEX IF NOT EXISTS idx_aichat_answer_vectors_share ON aichat_answer_vectors(share_id);
