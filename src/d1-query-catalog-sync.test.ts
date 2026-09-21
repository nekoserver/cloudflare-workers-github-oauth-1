import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(__dirname, '..');
const migration = fs.readFileSync(
  path.join(repoRoot, 'migrations/0154_reconcile_d1_query_catalog.sql'),
  'utf8',
);
const generator = fs.readFileSync(
  path.join(repoRoot, 'scripts/generate-d1-query-catalog-inserts.js'),
  'utf8',
);
const worker = fs.readFileSync(path.join(repoRoot, 'src/index.ts'), 'utf8');

describe('D1 query catalog snapshot synchronization', () => {
  it('0154はコピー完了まで元テーブルを保持してから入れ替える', () => {
    for (const sql of [migration, worker]) {
      const createStaging = sql.indexOf('CREATE TABLE d1_query_catalog_0154_new');
      const copyRows = sql.indexOf('INSERT INTO d1_query_catalog_0154_new');
      const dropOriginal = sql.indexOf('DROP TABLE d1_query_catalog;');
      const promoteStaging = sql.indexOf(
        'ALTER TABLE d1_query_catalog_0154_new RENAME TO d1_query_catalog;',
      );

      expect(createStaging).toBeGreaterThan(-1);
      expect(copyRows).toBeGreaterThan(createStaging);
      expect(dropOriginal).toBeGreaterThan(copyRows);
      expect(promoteStaging).toBeGreaterThan(dropOriginal);
      expect(sql).toContain('DROP TABLE IF EXISTS d1_query_catalog_0154_new;');
      expect(sql).not.toContain('RENAME TO d1_query_catalog_legacy');
    }
  });

  it('既存DBでは同名行から情報量が多く新しい1件を残す', () => {
    expect(migration).toContain('PARTITION BY lower(trim(query_name))');
    expect(migration).toContain('(table_name IS NOT NULL)');
    expect(migration).toContain('COALESCE(last_commit_at, recorded_at) DESC');
    expect(migration).toContain('WHERE duplicate_rank = 1');
  });

  it('行番号ではなくクエリ名を永続的な一意キーにする', () => {
    expect(migration).toMatch(/query_name TEXT NOT NULL COLLATE NOCASE UNIQUE/);
    expect(migration).not.toMatch(/UNIQUE\s*\(source_file,\s*source_line\)/);
    expect(generator).toContain('ON CONFLICT(query_name) DO UPDATE SET');
    expect(generator).not.toContain('ON CONFLICT(source_file, source_line)');
  });

  it('同期世代に存在しないNULL付き旧レコードも生成SQLの最後で削除する', () => {
    expect(migration).toContain('sync_generation TEXT');
    expect(generator).toContain('sync_generation = excluded.sync_generation');
    expect(generator).toContain('DELETE FROM d1_query_catalog WHERE sync_generation IS NULL OR sync_generation <>');
  });

  it('同一SQLの各用途は明示した安定クエリ名で同期する', () => {
    expect(generator).toContain('explicitQueryName(q.offset)');
    expect(worker).toContain('// d1-query-name: AutoRegisterTableColumns');
    expect(worker).toContain('// d1-query-name: StatusTablePreviewColumns');
    expect(worker).toContain('// d1-query-name: InsertWebhookAiSummaryReview');
    expect(worker).toContain('// d1-query-name: InsertAiSummaryFeedbackReview');
    expect(worker).toContain('// d1-query-name: SelectBulkRegisterExistingWines');
    expect(worker).toContain('// d1-query-name: SelectWineSeedConsistencyNames');
  });

  it('抽出失敗時は全削除につながる同期SQLを生成しない', () => {
    expect(generator).toContain('if (matches.length === 0)');
    expect(generator).toContain('refusing to generate a destructive synchronization file');
    expect(generator).toContain('Duplicate catalog query names');
  });

  it('0154適用後はD1内のテーブル・カラムカタログも新スキーマへ移行する', () => {
    for (const sql of [migration, worker]) {
      expect(sql).toContain("VALUES ('d1_query_catalog', 'config'");
      expect(sql).toContain('ON CONFLICT(table_name) DO UPDATE SET');
      expect(sql).toContain("DELETE FROM table_column_keys WHERE table_name = 'd1_query_catalog'");
      expect(sql).toContain("('d1_query_catalog', 'query_name', 'uk', NULL)");
      expect(sql).toContain("('d1_query_catalog', 'table_name', 'idx', NULL)");
    }
  });

  it('/statusはsync_generationの欠落を0154未適用として検出する', () => {
    const requiredColumnsStart = worker.indexOf('const REQUIRED_COLUMNS:');
    const requiredColumnsEnd = worker.indexOf('];', requiredColumnsStart);
    const requiredColumns = worker.slice(requiredColumnsStart, requiredColumnsEnd);
    expect(requiredColumns).toContain("migration: '0154', table: 'd1_query_catalog', column: 'sync_generation'");
    expect(requiredColumns).toContain("sql: STATUS_MIGRATION_SQL['0154']");
  });
});
