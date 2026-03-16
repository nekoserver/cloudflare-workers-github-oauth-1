-- GitHub App インストール権限をリポジトリ単位で保存
CREATE TABLE IF NOT EXISTS installation_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  installation_id INTEGER NOT NULL,
  repo_name TEXT,
  repository_selection TEXT NOT NULL DEFAULT 'selected',
  permissions TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_install_perm_repo
  ON installation_permissions (installation_id, repo_name);

CREATE INDEX IF NOT EXISTS idx_install_perm_updated
  ON installation_permissions (updated_at);
