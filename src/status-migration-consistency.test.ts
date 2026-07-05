/**
 * STATUS_TABLE_DEFINITIONS とマイグレーションファイルの整合性テスト
 *
 * マイグレーション番号の不一致により /status ページの表示が壊れる問題を防止する。
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');
const INDEX_TS_PATH = path.resolve(__dirname, 'index.ts');

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

describe('REQUIRED_COLUMNS（/status の未適用カラムマイグレーション検知）の整合性', () => {
  // マイグレーション0028(ai_summary_log.fallback_used/primary_model)は
  // ファイルとして存在するがREQUIRED_COLUMNSに未登録だったため、本番D1に
  // 未適用のまま3ヶ月間気づかれず、ai_summary_log/commit_agent_logへの
  // 書き込みが毎回SQLiteエラーで静かに失敗し続けていた。
  // 二度と同じ形で見落とさないよう、migrations/0028のファイル内容と
  // REQUIRED_COLUMNSの登録内容が一致することをテストで固定する。
  function extractRequiredColumnsBlock(): string {
    const src = fs.readFileSync(INDEX_TS_PATH, 'utf-8');
    const startIdx = src.indexOf('const REQUIRED_COLUMNS:');
    expect(startIdx).toBeGreaterThan(-1);
    const endIdx = src.indexOf('];', startIdx) + 2;
    return src.slice(startIdx, endIdx);
  }

  it('migration 0028 のファイルが ai_summary_log.fallback_used / primary_model を追加する内容である（前提条件）', () => {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, '0028_add_model_switch_columns.sql'), 'utf-8');
    expect(sql).toContain('ALTER TABLE ai_summary_log ADD COLUMN fallback_used');
    expect(sql).toContain('ALTER TABLE ai_summary_log ADD COLUMN primary_model');
  });

  it('REQUIRED_COLUMNS に ai_summary_log.fallback_used (migration 0028) が登録されている', () => {
    const block = extractRequiredColumnsBlock();
    expect(block).toContain("migration: '0028', table: 'ai_summary_log', column: 'fallback_used'");
  });

  it('REQUIRED_COLUMNS に ai_summary_log.primary_model (migration 0028) が登録されている', () => {
    const block = extractRequiredColumnsBlock();
    expect(block).toContain("migration: '0028', table: 'ai_summary_log', column: 'primary_model'");
  });
});
