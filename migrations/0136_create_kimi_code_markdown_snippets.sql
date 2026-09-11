CREATE TABLE IF NOT EXISTS kimi_code_markdown_snippets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  markdown TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_kimi_code_markdown_snippets_user_created ON kimi_code_markdown_snippets(user_id, created_at);
