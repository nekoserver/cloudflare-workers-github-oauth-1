CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  callback_url TEXT NOT NULL,
  webhook_secret_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  delivered_at TEXT,
  raw_payload TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_login_log_tenant ON login_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_login_log_occurred_at ON login_log(occurred_at);
CREATE INDEX IF NOT EXISTS idx_login_log_delivery_status ON login_log(delivery_status);
