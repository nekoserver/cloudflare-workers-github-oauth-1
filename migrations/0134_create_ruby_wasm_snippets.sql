CREATE TABLE IF NOT EXISTS ruby_wasm_snippets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  code TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'kimi-code',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ruby_wasm_snippets_user_created ON ruby_wasm_snippets(user_id, created_at);
