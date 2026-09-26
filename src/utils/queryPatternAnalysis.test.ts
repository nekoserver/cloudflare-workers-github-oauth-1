import { describe, it, expect } from 'vitest';
import {
  extractTableSchemasFromSql,
  buildStateForTable,
  JUDGMENT_LABELS,
  toInsertSql,
  toTableScoreRows,
  evaluateTable,
} from './queryPatternAnalysis';

describe('extractTableSchemasFromSql', () => {
  it('CREATE TABLE IF NOT EXISTSブロックをテーブル名とDDLに分解する', () => {
    const sql = `CREATE TABLE IF NOT EXISTS foo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);`;
    const result = extractTableSchemasFromSql(sql);
    expect(result).toHaveLength(1);
    expect(result[0].tableName).toBe('foo');
    expect(result[0].ddl).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT');
  });

  it('ALTER TABLE・CREATE INDEXのみのSQLは対象に含めない', () => {
    const sql = `ALTER TABLE foo ADD COLUMN bar TEXT;
CREATE INDEX IF NOT EXISTS idx_foo_bar ON foo(bar);`;
    expect(extractTableSchemasFromSql(sql)).toHaveLength(0);
  });

  it('同名テーブルが複数箇所で再宣言されている場合、最後の定義だけを残す', () => {
    const sql = `CREATE TABLE IF NOT EXISTS foo (
  id INTEGER PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS foo (
  id INTEGER PRIMARY KEY,
  extra_column TEXT
);`;
    const result = extractTableSchemasFromSql(sql);
    expect(result).toHaveLength(1);
    expect(result[0].ddl).toContain('extra_column');
  });

  it('複数のSTATUS_MIGRATION_SQL的な値を連結した文字列からも全テーブルを抽出できる', () => {
    const joined = [
      `CREATE TABLE IF NOT EXISTS a (id INTEGER PRIMARY KEY\n);`,
      `CREATE TABLE IF NOT EXISTS b (id INTEGER PRIMARY KEY\n);\nCREATE INDEX IF NOT EXISTS idx_b ON b(id);`,
    ].join('\n');
    const result = extractTableSchemasFromSql(joined);
    expect(result.map((r) => r.tableName)).toEqual(['a', 'b']);
  });
});

describe('buildStateForTable', () => {
  it('descriptionが無い場合はテーブル名+DDLのみ', () => {
    const state = buildStateForTable({ tableName: 'foo', ddl: 'CREATE TABLE foo (id INTEGER);' });
    expect(state).toContain('テーブル名: foo');
    expect(state).not.toContain('用途:');
  });

  it('descriptionがある場合はDDLより前に用途として含める', () => {
    const state = buildStateForTable({ tableName: 'foo', ddl: 'CREATE TABLE foo (id INTEGER);' }, 'テスト用テーブル');
    expect(state).toContain('用途: テスト用テーブル');
    expect(state.indexOf('用途:')).toBeLessThan(state.indexOf('CREATE TABLE'));
  });
});

describe('JUDGMENT_LABELS', () => {
  it('12問すべてが揃っており、idとcodeが重複しない', () => {
    expect(JUDGMENT_LABELS).toHaveLength(12);
    expect(new Set(JUDGMENT_LABELS.map((l) => l.id)).size).toBe(12);
    const codes = new Set(JUDGMENT_LABELS.map((l) => l.code));
    expect([...codes].sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']);
  });
});

describe('toInsertSql', () => {
  it('UPSERT用SQLを生成し、シングルクォートをエスケープする', () => {
    const sql = toInsertSql([{ tableName: "o'brien", code: 'A', score: 1 }]);
    expect(sql).toContain("'o''brien'");
    expect(sql).toContain('ON CONFLICT(table_name, judgment_code)');
  });
});

describe('toTableScoreRows', () => {
  it('Jevのlabel idを判断材料コードへ変換する', () => {
    const rows = toTableScoreRows('foo', { ok: true, scores: [{ labelId: 1, value: 1 }, { labelId: 12, value: 0 }] });
    expect(rows).toEqual([
      { tableName: 'foo', code: 'A', score: 1 },
      { tableName: 'foo', code: 'L', score: 0 },
    ]);
  });

  it('未知のlabel idはそのまま文字列化してcodeにする(想定外形状の可視化)', () => {
    const rows = toTableScoreRows('foo', { ok: true, scores: [{ labelId: 999, value: 1 }] });
    expect(rows).toEqual([{ tableName: 'foo', code: '999', score: 1 }]);
  });
});

describe('evaluateTable', () => {
  it('fetchImplへJev APIのリクエストを1回発行し、12問分のcriteriaを送る', async () => {
    let capturedBody: unknown = null;
    const fetchImpl = async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      const answers: Record<string, number> = {};
      for (let i = 1; i <= 12; i++) answers[String(i)] = i % 2;
      return {
        ok: true,
        status: 200,
        json: async () => ({ answers }),
        text: async () => '',
      };
    };

    const result = await evaluateTable({
      apiKey: 'test-key',
      schema: { tableName: 'foo', ddl: 'CREATE TABLE foo (id INTEGER);' },
      description: 'テスト用テーブル',
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.scores).toHaveLength(12);
    expect((capturedBody as { state: string }).state).toContain('用途: テスト用テーブル');
    expect(Object.keys((capturedBody as { questions: object }).questions)).toHaveLength(12);
  });
});
