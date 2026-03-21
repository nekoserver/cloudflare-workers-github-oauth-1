CREATE TABLE IF NOT EXISTS repo_color_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL DEFAULT '',
  repo_name TEXT NOT NULL,
  color_code TEXT NOT NULL DEFAULT '#667eea',
  display_order INTEGER NOT NULL DEFAULT 0,
  tags TEXT NOT NULL DEFAULT '',
  is_visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_repo_color_ws_repo
  ON repo_color_settings (workspace_id, repo_name);

CREATE INDEX IF NOT EXISTS idx_repo_color_order
  ON repo_color_settings (workspace_id, display_order);
