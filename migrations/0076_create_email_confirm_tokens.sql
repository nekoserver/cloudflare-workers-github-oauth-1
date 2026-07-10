CREATE TABLE IF NOT EXISTS email_confirm_tokens (
  token TEXT PRIMARY KEY,
  github_login TEXT NOT NULL,
  github_name TEXT,
  github_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  github_access_token TEXT NOT NULL,
  granted_scopes TEXT NOT NULL,
  timezone TEXT NOT NULL,
  session_duration TEXT NOT NULL,
  return_to TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);
