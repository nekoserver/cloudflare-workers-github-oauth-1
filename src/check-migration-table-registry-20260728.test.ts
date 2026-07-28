import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// 対象: scripts/check-migration-table-registry.js (PostToolUseフックスクリプト)。
// migrations/*.sql の新規CREATE TABLEに対し、src/index.ts の3レジストリ
// (STATUS_TABLE_DEFINITIONS/TABLE_COLUMN_KEYS/TABLE_GROUP_MAP)への登録漏れを
// 検知し、結果(ok/ng/error)をD1のharness_hook_logへ記録する(失敗時はローカル
// フォールバックへ記録+通知)。詳細は SPEC.cloudflare-workers-github-oauth-1.20260728.Harness.md。
//
// 故障シナリオ:
//   (1) CREATE TABLE文の抽出漏れ(IF NOT EXISTS有無、複数テーブル定義)
//   (2) レジストリブロックの終端マーカーがずれて誤検知/検知漏れになる
//   (3) SQLエスケープ漏れによるD1書き込み時のSQLインジェクション/構文エラー
//   (4) D1書き込み失敗時にログが握りつぶされ、記録も通知も残らない(ルール8違反)

// eslint-disable-next-line @typescript-eslint/no-var-requires
const scriptModule = require('../scripts/check-migration-table-registry.js');
const { extractCreateTableNames, checkRegistries, escSql, buildInsertSql, appendFallbackLog } = scriptModule;

describe('extractCreateTableNames', () => {
  it('IF NOT EXISTS付きのCREATE TABLEからテーブル名を抽出する', () => {
    const sql = `CREATE TABLE IF NOT EXISTS foo_bar (\n  id INTEGER PRIMARY KEY\n);`;
    expect(extractCreateTableNames(sql)).toEqual(['foo_bar']);
  });

  it('1ファイルに複数のCREATE TABLEがある場合すべて抽出する', () => {
    const sql = `CREATE TABLE IF NOT EXISTS a (id INTEGER);\nCREATE TABLE IF NOT EXISTS b (id INTEGER);`;
    expect(extractCreateTableNames(sql)).toEqual(['a', 'b']);
  });

  it('ALTER TABLEのみの場合は空配列を返す', () => {
    const sql = `ALTER TABLE foo ADD COLUMN bar TEXT;`;
    expect(extractCreateTableNames(sql)).toEqual([]);
  });

  it('同名テーブルが重複しても1回だけ返す', () => {
    const sql = `CREATE TABLE IF NOT EXISTS foo (id INTEGER);\nCREATE TABLE IF NOT EXISTS foo (id INTEGER);`;
    expect(extractCreateTableNames(sql)).toEqual(['foo']);
  });
});

describe('checkRegistries', () => {
  const fakeIndexTs = `
const STATUS_TABLE_DEFINITIONS: StatusTableDefinition[] = [
  { name: 'known_table', migration: '0001', description: 'x', syncPolicy: 'auto' },
];

export const TABLE_COLUMN_KEYS: Record<string, ColumnKeyInfo> = {
  known_table: { id: 'pk' },
};

export const TABLE_GROUP_MAP: Record<string, string> = {
  known_table: 'system',
};
`;

  it('全レジストリに登録済みのテーブルは missing 結果に含まれない', () => {
    const result = checkRegistries(['known_table'], fakeIndexTs);
    expect(result).toEqual([]);
  });

  it('どのレジストリにも無い新規テーブルは3つとも missing として報告する', () => {
    const result = checkRegistries(['brand_new_table'], fakeIndexTs);
    expect(result).toEqual([
      { table: 'brand_new_table', missing: ['STATUS_TABLE_DEFINITIONS', 'TABLE_COLUMN_KEYS', 'TABLE_GROUP_MAP'] },
    ]);
  });

  it('一部レジストリにのみ抜けがある場合はその分だけ報告する(実際に発見した4テーブルの再現)', () => {
    const partialIndexTs = `
const STATUS_TABLE_DEFINITIONS: StatusTableDefinition[] = [
  { name: 'heritage_area_boxes', migration: '0072', description: 'x', syncPolicy: 'auto' },
];

export const TABLE_COLUMN_KEYS: Record<string, ColumnKeyInfo> = {
};

export const TABLE_GROUP_MAP: Record<string, string> = {
};
`;
    const result = checkRegistries(['heritage_area_boxes'], partialIndexTs);
    expect(result).toEqual([
      { table: 'heritage_area_boxes', missing: ['TABLE_COLUMN_KEYS', 'TABLE_GROUP_MAP'] },
    ]);
  });
});

describe('escSql / buildInsertSql', () => {
  it('シングルクォートを二重化してエスケープする(SQLインジェクション/構文エラー対策)', () => {
    expect(escSql("O'Brien")).toBe("'O''Brien'");
  });

  it('null/undefinedはNULLリテラルになる', () => {
    expect(escSql(null)).toBe('NULL');
    expect(escSql(undefined)).toBe('NULL');
  });

  it('buildInsertSqlは harness_hook_log へのINSERT文を生成し、コメントを含まない', () => {
    const sql = buildInsertSql({
      hookEvent: 'PostToolUse',
      checkName: 'migration_table_registry_check',
      toolName: 'Write',
      filePath: "migrations/0099_create_it's_a_table.sql",
      result: 'ng',
      detail: "foo: TABLE_COLUMN_KEYS 未登録",
      sessionId: 'sess-1',
    });
    expect(sql).toContain('INSERT INTO harness_hook_log');
    expect(sql).toContain("it''s_a_table");
    expect(sql).not.toContain('--');
    expect(sql.trim().endsWith(';')).toBe(true);
  });
});

describe('appendFallbackLog(ルール8: D1書き込み失敗時の記録義務)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-hook-fallback-'));
  const fallbackPath = path.join(tmpDir, 'harness-hook-log-fallback.jsonl');

  afterEach(() => {
    if (fs.existsSync(fallbackPath)) fs.unlinkSync(fallbackPath);
  });

  it('D1書き込み失敗を模したエラーを渡すと、JSON1行として記録が残る(握りつぶされない)', () => {
    const row = { hookEvent: 'PostToolUse', checkName: 'migration_table_registry_check', result: 'ng', detail: 'x: TABLE_COLUMN_KEYS 未登録' };
    appendFallbackLog(fallbackPath, row, new Error('wrangler not authenticated'));

    expect(fs.existsSync(fallbackPath)).toBe(true);
    const lines = fs.readFileSync(fallbackPath, 'utf-8').trim().split('\n');
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.result).toBe('ng');
    expect(parsed.detail).toBe('x: TABLE_COLUMN_KEYS 未登録');
    expect(parsed.d1Error).toContain('wrangler not authenticated');
    expect(parsed.loggedAt).toBeTruthy();
  });

  it('複数回の失敗はappendされ、過去の記録を上書きしない', () => {
    appendFallbackLog(fallbackPath, { result: 'ng', detail: '1件目' }, new Error('e1'));
    appendFallbackLog(fallbackPath, { result: 'ng', detail: '2件目' }, new Error('e2'));
    const lines = fs.readFileSync(fallbackPath, 'utf-8').trim().split('\n');
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).detail).toBe('1件目');
    expect(JSON.parse(lines[1]).detail).toBe('2件目');
  });
});
