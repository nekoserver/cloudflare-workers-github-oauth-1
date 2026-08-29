CREATE TABLE IF NOT EXISTS countdown_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  label TEXT NOT NULL,
  target_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_countdown_events_user_target ON countdown_events(user_id, target_at);
