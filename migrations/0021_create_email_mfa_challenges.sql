CREATE TABLE IF NOT EXISTS email_mfa_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  source_id TEXT,
  resend_email_id TEXT,
  code_hash TEXT NOT NULL,
  code_type TEXT NOT NULL,
  code_algorithm TEXT NOT NULL DEFAULT 'random',
  totp_period INTEGER,
  totp_counter INTEGER,
  purpose TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  expires_at TEXT NOT NULL,
  verified_at TEXT,
  invalidated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES resend_webhook_sources(id)
);

CREATE INDEX IF NOT EXISTS idx_email_mfa_challenges_user_id ON email_mfa_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_email_mfa_challenges_resend_email_id ON email_mfa_challenges(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_email_mfa_challenges_expires_at ON email_mfa_challenges(expires_at);
