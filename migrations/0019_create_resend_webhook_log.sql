CREATE TABLE IF NOT EXISTS resend_webhook_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT,
  svix_id TEXT NOT NULL,
  resend_email_id TEXT,
  event_type TEXT NOT NULL,
  email_from TEXT,
  email_to TEXT,
  bounce_type TEXT,
  error_detail TEXT,
  slack_result TEXT,
  slack_result_at TEXT,
  proxy_result TEXT,
  proxy_result_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES resend_webhook_sources(id),
  UNIQUE (source_id, svix_id)
);

CREATE INDEX IF NOT EXISTS idx_resend_webhook_log_resend_email_id ON resend_webhook_log(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_resend_webhook_log_event_type ON resend_webhook_log(event_type);
CREATE INDEX IF NOT EXISTS idx_resend_webhook_log_created_at ON resend_webhook_log(created_at);
