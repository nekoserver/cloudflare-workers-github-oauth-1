CREATE TABLE IF NOT EXISTS workflow_hierarchy (
  child_workflow_no TEXT PRIMARY KEY,
  parent_workflow_no TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_workflow_hierarchy_parent ON workflow_hierarchy(parent_workflow_no);
