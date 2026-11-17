CREATE TABLE IF NOT EXISTS tailscale_node_health_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checked_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  node_state TEXT,
  node_ip TEXT,
  muse_online INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tailscale_node_health_checks_id ON tailscale_node_health_checks(id DESC);
