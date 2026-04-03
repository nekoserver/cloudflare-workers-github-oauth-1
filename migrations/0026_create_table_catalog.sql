CREATE TABLE IF NOT EXISTS table_catalog (
  table_name TEXT PRIMARY KEY,
  group_name TEXT NOT NULL,
  description TEXT NOT NULL,
  migration TEXT NOT NULL,
  sync_policy TEXT NOT NULL DEFAULT 'auto',
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS table_column_keys (
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  key_type TEXT NOT NULL,
  fk_target_table TEXT,
  PRIMARY KEY (table_name, column_name),
  FOREIGN KEY (table_name) REFERENCES table_catalog(table_name)
);

CREATE INDEX IF NOT EXISTS idx_table_catalog_group ON table_catalog(group_name);
CREATE INDEX IF NOT EXISTS idx_table_column_keys_fk ON table_column_keys(fk_target_table);
