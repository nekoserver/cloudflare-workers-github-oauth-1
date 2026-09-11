ALTER TABLE ruby_wasm_snippets ADD COLUMN ruby_version TEXT NOT NULL DEFAULT '3.4';
CREATE TABLE IF NOT EXISTS ruby_wasm_snippet_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snippet_id TEXT NOT NULL REFERENCES ruby_wasm_snippets(id),
  ruby_version TEXT NOT NULL,
  verified INTEGER NOT NULL,
  verified_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ruby_wasm_snippet_verifications_snippet ON ruby_wasm_snippet_verifications(snippet_id, verified_at);
