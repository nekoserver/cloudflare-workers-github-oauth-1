CREATE TABLE IF NOT EXISTS email_send_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT,
  resend_email_id TEXT,
  email_to TEXT NOT NULL,
  email_type TEXT NOT NULL,
  reference_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES resend_webhook_sources(id)
);

CREATE INDEX IF NOT EXISTS idx_email_send_log_resend_email_id ON email_send_log(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_email_send_log_source_id ON email_send_log(source_id);
CREATE INDEX IF NOT EXISTS idx_email_send_log_email_type ON email_send_log(email_type);
