CREATE TABLE IF NOT EXISTS d1_query_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query_name TEXT NOT NULL,
  command TEXT NOT NULL,
  command_confirmed INTEGER NOT NULL DEFAULT 0,
  table_name TEXT,
  source_file TEXT NOT NULL DEFAULT 'src/index.ts',
  source_line INTEGER NOT NULL,
  sql_text TEXT NOT NULL,
  migration_file TEXT,
  last_commit_hash TEXT,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_file, source_line)
);
CREATE INDEX IF NOT EXISTS idx_d1_query_catalog_table_name ON d1_query_catalog(table_name);
CREATE INDEX IF NOT EXISTS idx_d1_query_catalog_query_name ON d1_query_catalog(query_name);
