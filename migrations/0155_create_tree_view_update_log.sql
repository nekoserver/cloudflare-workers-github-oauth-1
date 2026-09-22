CREATE TABLE IF NOT EXISTS tree_view_update_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_name TEXT NOT NULL,
  update_source TEXT NOT NULL CHECK (update_source IN ('scheduled', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed')),
  changed INTEGER CHECK (changed IN (0, 1)),
  error_detail TEXT,
  executed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tree_view_update_log_executed
  ON tree_view_update_log(executed_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_tree_view_update_log_repo
  ON tree_view_update_log(repo_name, executed_at DESC);

INSERT INTO table_catalog (table_name, group_name, description, migration, sync_policy, display_order)
VALUES ('tree_view_update_log', 'commit', 'tree-view更新の実行履歴(cron/手動、変更有無)', '0155', 'auto', 0)
ON CONFLICT(table_name) DO UPDATE SET
  group_name = excluded.group_name,
  description = excluded.description,
  migration = excluded.migration,
  sync_policy = excluded.sync_policy;

INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
  ('tree_view_update_log', 'id', 'pk', NULL),
  ('tree_view_update_log', 'repo_name', 'fk+idx', 'installation_permissions'),
  ('tree_view_update_log', 'executed_at', 'idx', NULL);
