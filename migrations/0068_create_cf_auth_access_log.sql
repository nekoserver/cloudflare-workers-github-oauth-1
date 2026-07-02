CREATE TABLE IF NOT EXISTS cf_auth_access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  event TEXT,
  action TEXT,
  result TEXT NOT NULL,
  reason TEXT,
  checked_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cf_auth_access_log_username ON cf_auth_access_log(username);
CREATE INDEX IF NOT EXISTS idx_cf_auth_access_log_checked_at ON cf_auth_access_log(checked_at);
