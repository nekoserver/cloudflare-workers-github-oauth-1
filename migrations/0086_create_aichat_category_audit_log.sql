CREATE TABLE IF NOT EXISTS aichat_category_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_name TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_aichat_category_audit_log_user_created ON aichat_category_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aichat_category_audit_log_entity ON aichat_category_audit_log(entity_type, entity_id);
