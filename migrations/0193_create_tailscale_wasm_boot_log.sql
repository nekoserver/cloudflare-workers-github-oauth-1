CREATE TABLE IF NOT EXISTS tailscale_wasm_boot_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL CHECK(event IN ('boot_failed', 'state_discarded')),
  fingerprint TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_tailscale_wasm_boot_log_created ON tailscale_wasm_boot_log(created_at);
