import { describe, it, expect } from 'vitest';
import {
  extractTableSchemas,
  extractTableDescriptions,
  buildStateForTable,
  toInsertSql,
  JUDGMENT_LABELS,
} from './evaluate-table-pattern-scores';

describe('extractTableSchemas', () => {
  it('CREATE TABLE IF NOT EXISTSブロックをテーブル名とDDLに分解する', () => {
    const source = `
  '0001': \`CREATE TABLE IF NOT EXISTS foo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);\`,
`;
    const result = extractTableSchemas(source);
    expect(result).toHaveLength(1);
    expect(result[0].tableName).toBe('foo');
    expect(result[0].ddl).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT');
    expect(result[0].ddl).toContain('name TEXT NOT NULL');
  });

  it('複数のCREATE TABLEブロックをすべて抽出する', () => {
    const source = `
  '0001': \`CREATE TABLE IF NOT EXISTS foo (
  id INTEGER PRIMARY KEY
);\`,
  '0002': \`CREATE TABLE IF NOT EXISTS bar (
  id INTEGER PRIMARY KEY
);
CREATE INDEX IF NOT EXISTS idx_bar_id ON bar(id);\`,
`;
    const result = extractTableSchemas(source);
    expect(result.map((r) => r.tableName)).toEqual(['foo', 'bar']);
  });

  it('ALTER TABLE・CREATE INDEXのみのマイグレーションは対象に含めない', () => {
    const source = `
  '0003': \`ALTER TABLE foo ADD COLUMN bar TEXT;
CREATE INDEX IF NOT EXISTS idx_foo_bar ON foo(bar);\`,
`;
    expect(extractTableSchemas(source)).toHaveLength(0);
  });

  it('CREATE TABLEが1件も無ければ空配列を返す', () => {
    expect(extractTableSchemas('')).toEqual([]);
  });

  it('同名テーブルが複数マイグレーションで再宣言されている場合、最後の定義だけを残す', () => {
    const source = `
  '0001': \`CREATE TABLE IF NOT EXISTS foo (
  id INTEGER PRIMARY KEY
);\`,
  '0002': \`CREATE TABLE IF NOT EXISTS foo (
  id INTEGER PRIMARY KEY,
  extra_column TEXT
);\`,
`;
    const result = extractTableSchemas(source);
    expect(result).toHaveLength(1);
    expect(result[0].ddl).toContain('extra_column');
  });
});

describe('extractTableDescriptions', () => {
  it('STATUS_TABLE_DEFINITIONSからテーブル名→description のマップを作る', () => {
    const source = `
export const STATUS_TABLE_DEFINITIONS: StatusTableDefinition[] = [
  { name: 'user_sessions', migration: '0001', description: 'ユーザーセッション・設定', syncPolicy: 'auto' },
  { name: 'heritage_master', migration: '0112', description: '世界遺産マスタ登録簿', syncPolicy: 'manual' },
];
`;
    const result = extractTableDescriptions(source);
    expect(result.get('user_sessions')).toBe('ユーザーセッション・設定');
    expect(result.get('heritage_master')).toBe('世界遺産マスタ登録簿');
    expect(result.size).toBe(2);
  });

  it('登録が無ければ空のマップを返す', () => {
    expect(extractTableDescriptions('').size).toBe(0);
  });

  it('descriptionにエスケープされたシングルクォートを含む場合も正しく取り出す', () => {
    const source = `{ name: 'foo', migration: '0001', description: 'it\\'s a test', syncPolicy: 'auto' },`;
    expect(extractTableDescriptions(source).get('foo')).toBe("it's a test");
  });
});

describe('buildStateForTable', () => {
  it('テーブル名とDDLを含む評価対象テキストを組み立てる', () => {
    const state = buildStateForTable({ tableName: 'foo', ddl: 'CREATE TABLE foo (id INTEGER);' });
    expect(state).toContain('テーブル名: foo');
    expect(state).toContain('CREATE TABLE foo (id INTEGER);');
    expect(state).not.toContain('用途:');
  });

  it('descriptionが渡された場合はDDLの前に用途として含める', () => {
    const state = buildStateForTable(
      { tableName: 'heritage_master', ddl: 'CREATE TABLE heritage_master (id TEXT);' },
      '世界遺産マスタ登録簿',
    );
    expect(state).toContain('用途: 世界遺産マスタ登録簿');
    expect(state.indexOf('用途:')).toBeLessThan(state.indexOf('CREATE TABLE'));
  });
});

describe('JUDGMENT_LABELS', () => {
  it('判断材料A〜Lの12問すべてが揃っており、idとcodeが重複しない', () => {
    expect(JUDGMENT_LABELS).toHaveLength(12);
    const ids = new Set(JUDGMENT_LABELS.map((l) => l.id));
    const codes = new Set(JUDGMENT_LABELS.map((l) => l.code));
    expect(ids.size).toBe(12);
    expect(codes.size).toBe(12);
    expect([...codes].sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']);
  });

  it('各ラベルのcriteriaは2要素配列である(Jev APIのscore型要件)', () => {
    for (const label of JUDGMENT_LABELS) {
      expect(label.criteria).toHaveLength(2);
    }
  });
});

describe('toInsertSql', () => {
  it('table_name・judgment_code・scoreを含むUPSERT用SQLを生成する', () => {
    const sql = toInsertSql([{ tableName: 'foo', code: 'A', score: 1 }]);
    expect(sql).toContain("INSERT INTO jev_table_pattern_scores");
    expect(sql).toContain("'foo'");
    expect(sql).toContain("'A'");
    expect(sql).toContain('1');
    expect(sql).toContain('ON CONFLICT(table_name, judgment_code)');
  });

  it('テーブル名中のシングルクォートをエスケープする', () => {
    const sql = toInsertSql([{ tableName: "o'brien", code: 'A', score: 0 }]);
    expect(sql).toContain("'o''brien'");
  });

  it('複数行をそれぞれ独立した文として出力する', () => {
    const sql = toInsertSql([
      { tableName: 'foo', code: 'A', score: 1 },
      { tableName: 'foo', code: 'B', score: 0 },
    ]);
    expect(sql.split('\n')).toHaveLength(2);
  });
});
