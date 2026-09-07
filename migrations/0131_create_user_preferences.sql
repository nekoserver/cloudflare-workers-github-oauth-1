CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT NOT NULL,
  pref_key TEXT NOT NULL,
  pref_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, pref_key)
);
CREATE INDEX IF NOT EXISTS idx_user_preferences_updated_at ON user_preferences(updated_at);
