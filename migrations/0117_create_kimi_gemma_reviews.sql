CREATE TABLE IF NOT EXISTS kimi_gemma_reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kimi_prompt TEXT NOT NULL,
  kimi_code TEXT NOT NULL,
  gemma_prompt TEXT NOT NULL,
  gemma_response TEXT NOT NULL,
  gemma_model TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_kimi_gemma_reviews_user_created ON kimi_gemma_reviews(user_id, created_at);
