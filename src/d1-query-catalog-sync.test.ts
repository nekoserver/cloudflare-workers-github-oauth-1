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

describe('D1 query catalog snapshot synchronization', () => {
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

  it('抽出失敗時は全削除につながる同期SQLを生成しない', () => {
    expect(generator).toContain('if (matches.length === 0)');
    expect(generator).toContain('refusing to generate a destructive synchronization file');
    expect(generator).toContain('Duplicate catalog query names');
  });
});
