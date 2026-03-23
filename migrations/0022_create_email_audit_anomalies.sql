CREATE TABLE IF NOT EXISTS email_audit_anomalies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  target_user_id TEXT,
  target_email TEXT,
  source_id TEXT,
  metric_value REAL NOT NULL,
  threshold_value REAL NOT NULL,
  detail TEXT,
  acknowledged_at TEXT,
  acknowledged_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES resend_webhook_sources(id),
  UNIQUE (period_start, period_end, anomaly_type, target_user_id, target_email, source_id)
);

CREATE INDEX IF NOT EXISTS idx_email_audit_anomalies_anomaly_type ON email_audit_anomalies(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_email_audit_anomalies_severity ON email_audit_anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_email_audit_anomalies_period ON email_audit_anomalies(period_start, period_end);
