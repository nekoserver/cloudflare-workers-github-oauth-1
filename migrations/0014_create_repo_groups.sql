CREATE TABLE IF NOT EXISTS repo_groups (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color_code TEXT NOT NULL DEFAULT '#667eea',
  icon TEXT NOT NULL DEFAULT '',
  slack_channel_id TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_repo_groups_ws
  ON repo_groups (workspace_id, display_order);

CREATE TABLE IF NOT EXISTS repo_group_members (
  group_id TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT '',
  added_at TEXT NOT NULL,
  PRIMARY KEY (group_id, repo_name),
  FOREIGN KEY (group_id) REFERENCES repo_groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_repo_group_members_repo
  ON repo_group_members (workspace_id, repo_name);
