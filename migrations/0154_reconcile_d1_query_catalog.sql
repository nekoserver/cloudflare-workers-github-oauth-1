ALTER TABLE d1_query_catalog RENAME TO d1_query_catalog_legacy;

CREATE TABLE d1_query_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  command TEXT NOT NULL,
  command_confirmed INTEGER NOT NULL DEFAULT 0,
  table_name TEXT,
  source_file TEXT NOT NULL DEFAULT 'src/index.ts',
  source_line INTEGER NOT NULL,
  sql_text TEXT NOT NULL,
  migration_file TEXT,
  last_commit_hash TEXT,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_commit_at TEXT,
  sync_generation TEXT
);

INSERT INTO d1_query_catalog (
  query_name, command, command_confirmed, table_name, source_file, source_line,
  sql_text, migration_file, last_commit_hash, recorded_at, last_commit_at
)
SELECT query_name, command, command_confirmed, table_name, source_file, source_line,
       sql_text, migration_file, last_commit_hash, recorded_at, last_commit_at
FROM (
  SELECT d.*,
         ROW_NUMBER() OVER (
           PARTITION BY lower(trim(query_name))
           ORDER BY
             ((table_name IS NOT NULL) + (migration_file IS NOT NULL) +
              (last_commit_hash IS NOT NULL) + (last_commit_at IS NOT NULL)) DESC,
             COALESCE(last_commit_at, recorded_at) DESC,
             id DESC
         ) AS duplicate_rank
  FROM d1_query_catalog_legacy d
)
WHERE duplicate_rank = 1;

DROP TABLE d1_query_catalog_legacy;

CREATE INDEX idx_d1_query_catalog_table_name ON d1_query_catalog(table_name);
CREATE INDEX idx_d1_query_catalog_source ON d1_query_catalog(source_file, source_line);

INSERT INTO table_catalog (table_name, group_name, description, migration, sync_policy, display_order)
VALUES ('d1_query_catalog', 'config', 'D1クエリカタログ: src/index.tsのSQLクエリ一覧', '0154', 'manual', 0)
ON CONFLICT(table_name) DO UPDATE SET
  group_name = excluded.group_name,
  description = excluded.description,
  migration = excluded.migration,
  sync_policy = excluded.sync_policy;
DELETE FROM table_column_keys WHERE table_name = 'd1_query_catalog';
INSERT INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
  ('d1_query_catalog', 'id', 'pk', NULL),
  ('d1_query_catalog', 'query_name', 'uk', NULL),
  ('d1_query_catalog', 'table_name', 'idx', NULL),
  ('d1_query_catalog', 'source_file', 'idx', NULL),
  ('d1_query_catalog', 'source_line', 'idx', NULL);
