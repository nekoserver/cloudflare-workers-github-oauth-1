CREATE TABLE IF NOT EXISTS uuid_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  uuid TEXT NOT NULL,
  version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_uuid_history_user_id ON uuid_history(user_id);
CREATE INDEX IF NOT EXISTS idx_uuid_history_uuid ON uuid_history(uuid);
CREATE INDEX IF NOT EXISTS idx_uuid_history_created_at ON uuid_history(created_at DESC);
