CREATE TABLE IF NOT EXISTS heritage_master (
  id TEXT PRIMARY KEY,
  flag TEXT NOT NULL,
  country_name TEXT NOT NULL,
  heritage_name TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  registered_year INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  classification_icon TEXT NOT NULL,
  free_icon TEXT NOT NULL,
  delete_mark TEXT,
  moved_to TEXT,
  source TEXT NOT NULL DEFAULT 'heritageList.ts',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  CHECK (delete_mark IS NULL OR length(delete_mark) = 1),
  FOREIGN KEY (moved_to) REFERENCES heritage_master(id)
);
CREATE INDEX IF NOT EXISTS idx_heritage_master_moved_to ON heritage_master(moved_to);
CREATE INDEX IF NOT EXISTS idx_heritage_master_country ON heritage_master(country_name);
