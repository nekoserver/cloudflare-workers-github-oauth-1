CREATE TABLE IF NOT EXISTS aichat_response_keyword_hits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  share_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  match_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, share_id, keyword)
);
CREATE INDEX IF NOT EXISTS idx_arwkh_user_share ON aichat_response_keyword_hits(user_id, share_id);
CREATE INDEX IF NOT EXISTS idx_arwkh_user_keyword ON aichat_response_keyword_hits(user_id, keyword);
