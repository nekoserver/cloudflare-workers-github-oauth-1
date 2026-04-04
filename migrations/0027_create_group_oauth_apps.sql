CREATE TABLE IF NOT EXISTS group_oauth_apps (
  group_id TEXT NOT NULL,
  app_name TEXT NOT NULL,
  app_note TEXT NOT NULL DEFAULT '',
  workspace_id TEXT NOT NULL DEFAULT '',
  added_at TEXT NOT NULL,
  PRIMARY KEY (group_id, app_name),
  FOREIGN KEY (group_id) REFERENCES repo_groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_group_oauth_apps_ws ON group_oauth_apps (workspace_id);
