CREATE TABLE IF NOT EXISTS askgk_timeout_settings (
  revision INTEGER PRIMARY KEY CHECK (revision >= 1),
  timeout_seconds INTEGER NOT NULL CHECK (timeout_seconds BETWEEN 1 AND 300),
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL
);
INSERT OR IGNORE INTO askgk_timeout_settings (revision, timeout_seconds, changed_by, changed_at)
VALUES (1, 120, 'migration:0189', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
