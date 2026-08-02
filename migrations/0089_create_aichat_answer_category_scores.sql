CREATE TABLE IF NOT EXISTS aichat_answer_category_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES aichat_keyword_categories(id),
  score REAL NOT NULL,
  model TEXT NOT NULL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aichat_answer_category_scores_unique ON aichat_answer_category_scores(user_id, share_id, category_id);
CREATE INDEX IF NOT EXISTS idx_aichat_answer_category_scores_share ON aichat_answer_category_scores(share_id);
