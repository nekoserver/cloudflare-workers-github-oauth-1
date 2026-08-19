CREATE TABLE IF NOT EXISTS workflow_registry (
  workflow_no TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  page_path TEXT NOT NULL,
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS workflow_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_no TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  stage_title TEXT NOT NULL,
  api_method TEXT,
  api_path TEXT,
  note TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_steps_order ON workflow_steps(workflow_no, step_order);
