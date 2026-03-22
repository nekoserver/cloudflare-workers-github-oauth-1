CREATE TABLE IF NOT EXISTS ai_summary_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  summary_request_id TEXT NOT NULL,
  rating TEXT NOT NULL,
  reviewer_type TEXT NOT NULL DEFAULT 'human',
  reviewer_name TEXT,
  review_model TEXT,
  comment TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (summary_request_id) REFERENCES ai_summary_log(request_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_summary_reviews_request_id
  ON ai_summary_reviews (summary_request_id);

CREATE INDEX IF NOT EXISTS idx_ai_summary_reviews_rating
  ON ai_summary_reviews (rating);
