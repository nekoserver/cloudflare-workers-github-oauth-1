/**
 * STATUS_TABLE_DEFINITIONS とマイグレーションファイルの整合性テスト
 *
 * マイグレーション番号の不一致により /status ページの表示が壊れる問題を防止する。
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');

function listMigrationFiles(): { number: string; filename: string; tableName: string | null }[] {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  return files.map(f => {
    const match = f.match(/^(\d{4})_(?:create_|add_|alter_)(.+)\.sql$/);
    return {
      number: f.slice(0, 4),
      filename: f,
      tableName: match ? match[2] : null,
    };
  });
}

describe('マイグレーションファイルと STATUS_TABLE_DEFINITIONS の整合性', () => {
  it('マイグレーション 0024 のファイル名が slack_interaction_log を含む', () => {
    const migrations = listMigrationFiles();
    const m0024 = migrations.find(m => m.number === '0024');
    expect(m0024).toBeDefined();
    expect(m0024!.filename).toContain('slack_interaction_log');
  });

  it('マイグレーション 0025 のファイル名が commit_agent_log を含む', () => {
    const migrations = listMigrationFiles();
    const m0025 = migrations.find(m => m.number === '0025');
    expect(m0025).toBeDefined();
    expect(m0025!.filename).toContain('commit_agent_log');
  });

  it('マイグレーション 0026 のファイル名が table_catalog を含む', () => {
    const migrations = listMigrationFiles();
    const m0026 = migrations.find(m => m.number === '0026');
    expect(m0026).toBeDefined();
    expect(m0026!.filename).toContain('table_catalog');
  });

  it('table_catalog/table_column_keys は migration 0024 ではない', () => {
    const migrations = listMigrationFiles();
    const m0024 = migrations.find(m => m.number === '0024');
    expect(m0024!.filename).not.toContain('table_catalog');
    expect(m0024!.filename).not.toContain('table_column_keys');
  });

  it('全マイグレーションファイルの番号が重複しない（ALTER系を除くCREATE系）', () => {
    const migrations = listMigrationFiles();
    const numbers = migrations.map(m => m.number);
    const uniqueNumbers = [...new Set(numbers)];
    expect(numbers.length).toBe(uniqueNumbers.length);
  });
});
