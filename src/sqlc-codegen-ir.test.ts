import { describe, expect, it } from 'vitest';
import { buildSqlcIr, compareSqlcIr, formatSqlcIrMarkdown } from '../scripts/sqlc-codegen-ir.js';

const request = {
  settings: { engine: 'sqlite' },
  queries: [
    {
      name: 'UpdateUser',
      cmd: ':one',
      filename: 'query.sql',
      params: [
        { column: { name: 'name', type: 'text', notNull: true } },
        { column: { name: 'bio', type: 'text', notNull: false } },
      ],
      columns: [
        { name: 'id', type: 'integer', notNull: true, table: { name: 'users' } },
        { name: 'bio', type: 'text', notNull: false, table: { name: 'users' } },
      ],
    },
  ],
};

describe('sqlc CodegenRequest IR', () => {
  it('sqlcが解析したパラメータ・結果列・command意味論を正規化する', () => {
    const ir = buildSqlcIr(request);

    expect(ir.version).toBe(1);
    expect(ir.engine).toBe('sqlite');
    expect(ir.queries[0]).toMatchObject({
      name: 'UpdateUser',
      command: ':one',
      cardinality: { minimum: 0, maximum: 1 },
      parameters: [
        { name: 'name', databaseType: 'text', nullable: false },
        { name: 'bio', databaseType: 'text', nullable: true },
      ],
      resultColumns: [
        { name: 'id', source: 'users.id', databaseType: 'integer', nullable: false },
        { name: 'bio', source: 'users.bio', databaseType: 'text', nullable: true },
      ],
    });
  });

  it('protobuf JSONのsnake_caseとnullableフィールドにも対応する', () => {
    const ir = buildSqlcIr({
      settings: { engine: 'postgresql' },
      queries: [{
        name: 'FindUser', cmd: 'one',
        params: [{ column: { name: 'email', type: 'text', not_null: false } }],
        columns: [{ name: 'display_name', type: 'text', not_null: false, table: { name: 'users' } }],
      }],
    });

    expect(ir.queries[0].command).toBe(':one');
    expect(ir.queries[0].parameters[0].nullable).toBe(true);
    expect(ir.queries[0].resultColumns[0].source).toBe('users.display_name');
  });

  it('query削除・command変更・必須parameter追加・result変更をbreakingとして検出する', () => {
    const baseline = buildSqlcIr({ queries: [
      { name: 'Removed', cmd: ':exec', params: [], columns: [] },
      { name: 'GetUser', cmd: ':one', params: [], columns: [{ name: 'id', type: 'integer', notNull: true }] },
    ] });
    const current = buildSqlcIr({ queries: [
      { name: 'GetUser', cmd: ':many', params: [{ column: { name: 'tenant_id', type: 'integer', notNull: true } }], columns: [{ name: 'id', type: 'text', notNull: true }] },
    ] });

    const diff = compareSqlcIr(baseline, current);
    expect(diff.breaking.map((finding: { code: string }) => finding.code)).toEqual([
      'QUERY_REMOVED',
      'COMMAND_CHANGED',
      'REQUIRED_PARAMETER_ADDED',
      'RESULT_TYPE_CHANGED',
    ]);
  });

  it('nullable parameterの追加は非breakingとして区別する', () => {
    const baseline = buildSqlcIr({ queries: [{ name: 'Search', cmd: ':many', params: [], columns: [] }] });
    const current = buildSqlcIr({ queries: [{
      name: 'Search', cmd: ':many', columns: [],
      params: [{ column: { name: 'cursor', type: 'text', notNull: false } }],
    }] });

    const diff = compareSqlcIr(baseline, current);
    expect(diff.breaking).toEqual([]);
    expect(diff.nonBreaking[0].code).toBe('NULLABLE_PARAMETER_ADDED');
  });

  it('Markdownを罫線文字なしで出力する', () => {
    const markdown = formatSqlcIrMarkdown(buildSqlcIr(request));
    expect(markdown).toContain('| UpdateUser | :one | 0..1 |');
    expect(markdown).toContain('bio: text \\| null');
    expect(markdown).not.toMatch(/[─│┼├└▼]/u);
  });
});
