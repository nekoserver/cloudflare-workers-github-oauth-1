-- d1_query_catalog はソースから再生成するスナップショットであり、行番号は
-- コード編集のたびに変わる。旧来のソース位置一意制約では行移動を
-- UPDATE と認識できず、古い(NULLを含む)行が残るため、論理名を一意キーにする。
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

-- 同名の既存行は、情報が最も多く、新しい行を1件だけ引き継ぐ。
-- これにより「更新版が別行に入り、NULLを含む旧行も残る」状態を解消する。
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
