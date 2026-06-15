ALTER TABLE user_sessions ADD COLUMN revoked_at TEXT;
CREATE INDEX IF NOT EXISTS idx_user_sessions_revoked_at ON user_sessions(revoked_at);
