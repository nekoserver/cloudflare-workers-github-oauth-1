CREATE TABLE IF NOT EXISTS container_ssh_public_keys (
  key_identity TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT
);
