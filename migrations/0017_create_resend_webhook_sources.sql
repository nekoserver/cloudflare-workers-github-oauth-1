CREATE TABLE IF NOT EXISTS resend_webhook_sources (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  resend_account_id TEXT,
  svix_endpoint_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
