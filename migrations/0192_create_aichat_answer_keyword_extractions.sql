CREATE TABLE IF NOT EXISTS aichat_model_names (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS aichat_answer_keyword_extractions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_id TEXT NOT NULL REFERENCES ai_chat_shares(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  model_id INTEGER NOT NULL REFERENCES aichat_model_names(id),
  dim INTEGER CHECK(dim IS NULL OR dim > 0),
  document_vector BLOB,
  candidate_count INTEGER CHECK(candidate_count IS NULL OR candidate_count >= 0),
  score_method TEXT NOT NULL,
  fallback_error_code TEXT,
  fallback_detail TEXT,
  extracted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(user_id, share_id, model_id)
);
CREATE INDEX IF NOT EXISTS idx_aichat_answer_keyword_extractions_share ON aichat_answer_keyword_extractions(share_id);
CREATE TABLE IF NOT EXISTS aichat_answer_extracted_keywords (
  extraction_id INTEGER NOT NULL REFERENCES aichat_answer_keyword_extractions(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL CHECK(rank >= 1),
  keyword TEXT NOT NULL,
  score REAL,
  occurrence_count INTEGER NOT NULL DEFAULT 0 CHECK(occurrence_count >= 0),
  vector BLOB,
  PRIMARY KEY(extraction_id, rank),
  UNIQUE(extraction_id, keyword)
);
CREATE INDEX IF NOT EXISTS idx_aichat_answer_extracted_keywords_keyword ON aichat_answer_extracted_keywords(keyword);
CREATE TABLE IF NOT EXISTS aichat_answer_keyword_scores (
  extraction_id INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  model_id INTEGER NOT NULL REFERENCES aichat_model_names(id),
  similarity REAL NOT NULL,
  score_method TEXT NOT NULL,
  PRIMARY KEY(extraction_id, rank, model_id),
  FOREIGN KEY(extraction_id, rank) REFERENCES aichat_answer_extracted_keywords(extraction_id, rank) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_aichat_answer_keyword_scores_model ON aichat_answer_keyword_scores(model_id, similarity);
