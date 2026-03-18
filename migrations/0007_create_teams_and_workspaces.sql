-- チーム・ワークスペースによるネームスペース分離
-- 1人チームであっても必ずチーム→ワークスペースの階層でデータを分離する

-- チーム
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ワークスペース（チームに属する）
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id)
);

CREATE INDEX IF NOT EXISTS idx_workspaces_team ON workspaces (team_id);

-- チームメンバー
CREATE TABLE IF NOT EXISTS team_members (
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL,
  PRIMARY KEY (team_id, user_id),
  FOREIGN KEY (team_id) REFERENCES teams(id)
);

-- user_sessions に現在のワークスペースIDを追加
ALTER TABLE user_sessions ADD COLUMN current_workspace_id TEXT;

-- commit_calendar_cache: user_id → workspace_id に移行
-- 0006 で追加した user_id は空文字のままなので workspace_id に置き換える
ALTER TABLE commit_calendar_cache ADD COLUMN workspace_id TEXT NOT NULL DEFAULT '';

-- 既存の user_id ベースのインデックスを削除し workspace_id ベースに置き換え
DROP INDEX IF EXISTS idx_commit_calendar_user_owner_repo_ym;

CREATE UNIQUE INDEX idx_commit_calendar_ws_owner_repo_ym
  ON commit_calendar_cache (workspace_id, owner, repo, year, month);
