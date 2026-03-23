CREATE TABLE IF NOT EXISTS email_suppression_list (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  source_id TEXT,
  reason TEXT NOT NULL,
  origin_webhook_log_id INTEGER,
  suppressed_at TEXT NOT NULL DEFAULT (datetime('now')),
  resubscribed_at TEXT,
  FOREIGN KEY (source_id) REFERENCES resend_webhook_sources(id),
  FOREIGN KEY (origin_webhook_log_id) REFERENCES resend_webhook_log(id),
  UNIQUE (email, source_id)
);

CREATE INDEX IF NOT EXISTS idx_email_suppression_list_email ON email_suppression_list(email);
