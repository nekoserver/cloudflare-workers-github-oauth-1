CREATE TABLE IF NOT EXISTS mention_editor_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL COLLATE NOCASE,
  config_json TEXT NOT NULL CHECK (json_valid(config_json)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, title)
);

CREATE INDEX IF NOT EXISTS idx_mention_editor_documents_user_updated
  ON mention_editor_documents(user_id, updated_at DESC);
