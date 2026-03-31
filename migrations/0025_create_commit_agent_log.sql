CREATE TABLE IF NOT EXISTS commit_agent_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  repo_full_name TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  commit_sha TEXT,
  commit_message TEXT,
  commit_author_name TEXT,
  commit_author_email TEXT,
  detected_agent_name TEXT,
  detected_agent_version TEXT,
  detected_signal TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_commit_agent_log_request ON commit_agent_log(request_id);
CREATE INDEX IF NOT EXISTS idx_commit_agent_log_repo_pr ON commit_agent_log(repo_full_name, pr_number);
