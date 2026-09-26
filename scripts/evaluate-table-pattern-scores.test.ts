import { describe, it, expect } from 'vitest';
import { extractTableDescriptions } from './evaluate-table-pattern-scores';

// extractTableSchemas(= extractTableSchemasFromSql)・buildStateForTable・
// JUDGMENT_LABELS・toInsertSqlは src/utils/queryPatternAnalysis.ts からの
// 再エクスポートであり、そちらの queryPatternAnalysis.test.ts で検証済み。
// ここではCLI版だけが持つ、生のsrc/index.tsテキストからSTATUS_TABLE_DEFINITIONS
// を正規表現で読み取る extractTableDescriptions だけを検証する
// (Worker版は構造化された配列をそのまま持てるため、この正規表現抽出は不要)。

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
