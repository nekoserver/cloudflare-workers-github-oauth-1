CREATE TABLE IF NOT EXISTS securemine_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  base_url TEXT NOT NULL,
  account_name TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  redmine_user_json TEXT NOT NULL,
  logged_in_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_securemine_session_expiry ON securemine_sessions(expires_at);
CREATE TABLE IF NOT EXISTS securemine_login_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  base_url TEXT NOT NULL,
  redmine_user_id INTEGER NOT NULL,
  logged_in_at TEXT NOT NULL
);
