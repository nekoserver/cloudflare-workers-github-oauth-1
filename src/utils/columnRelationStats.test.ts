import { describe, expect, it } from 'vitest';
import {
  aggregateColumnTables,
  countRelationsByColumnName,
  computeColumnRelationStats,
  getMultiTableColumns,
  findMissingRelations,
  verifyColumnStats,
  type TableSchema,
  type Relation,
} from './columnRelationStats';

describe('aggregateColumnTables', () => {
  it('カラム名ごとに出現テーブルを集める', () => {
    const tables: TableSchema[] = [
      { name: 't1', cols: [{ name: 'id' }, { name: 'repo_name' }] },
      { name: 't2', cols: [{ name: 'id' }, { name: 'repo_name' }] },
      { name: 't3', cols: [{ name: 'id' }, { name: 'user_id' }] },
    ];
    const result = aggregateColumnTables(tables);
    expect(Array.from(result.get('id')!)).toEqual(['t1', 't2', 't3']);
    expect(Array.from(result.get('repo_name')!).sort()).toEqual(['t1', 't2']);
    expect(Array.from(result.get('user_id')!)).toEqual(['t3']);
  });

  it('空配列では空マップを返す', () => {
    expect(aggregateColumnTables([]).size).toBe(0);
  });

  it('cols が空のテーブルも安全に扱える', () => {
    const tables: TableSchema[] = [{ name: 't1', cols: [] }];
    expect(aggregateColumnTables(tables).size).toBe(0);
  });
});

describe('countRelationsByColumnName', () => {
  it('同名カラムのリレーションを集計する', () => {
    const rels: Relation[] = [
      ['a', 'repo_name', 'b', 'repo_name', '多:多'],
      ['b', 'repo_name', 'c', 'repo_name', '多:多'],
    ];
    const result = countRelationsByColumnName(rels);
    expect(result.get('repo_name')).toBe(2);
  });

  it('異名カラムの FK も from 側で集計する', () => {
    const rels: Relation[] = [
      ['workspaces', 'team_id', 'teams', 'id', '多:1'],
    ];
    const result = countRelationsByColumnName(rels);
    expect(result.get('team_id')).toBe(1);
    expect(result.get('id')).toBeUndefined();
  });
});

describe('computeColumnRelationStats', () => {
  const tables: TableSchema[] = [
    { name: 'installation_permissions', cols: [{ name: 'id' }, { name: 'repo_name' }] },
    { name: 'repo_color_settings', cols: [{ name: 'id' }, { name: 'repo_name' }, { name: 'workspace_id' }] },
    { name: 'repo_group_members', cols: [{ name: 'repo_name' }, { name: 'workspace_id' }, { name: 'group_id' }] },
    { name: 'repo_groups', cols: [{ name: 'id' }, { name: 'workspace_id' }] },
  ];

  it('repo_name が 3 テーブルに出現 → 期待リレーション数は 2', () => {
    const stats = computeColumnRelationStats(tables, []);
    const repoName = stats.find((s) => s.columnName === 'repo_name');
    expect(repoName).toBeDefined();
    expect(repoName!.tableCount).toBe(3);
    expect(repoName!.expectedRelations).toBe(2);
    expect(repoName!.actualRelations).toBe(0);
    expect(repoName!.missing).toBe(2);
  });

  it('リレーションが定義されていれば missing が減る', () => {
    const rels: Relation[] = [
      ['repo_color_settings', 'repo_name', 'installation_permissions', 'repo_name', '多:1'],
      ['repo_group_members', 'repo_name', 'installation_permissions', 'repo_name', '多:1'],
    ];
    const stats = computeColumnRelationStats(tables, rels);
    const repoName = stats.find((s) => s.columnName === 'repo_name');
    expect(repoName!.missing).toBe(0);
    expect(repoName!.actualRelations).toBe(2);
  });

  it('テーブル数が多いカラムが上位にソートされる', () => {
    const stats = computeColumnRelationStats(tables, []);
    // id/repo_name/workspace_id がいずれも 3 テーブル。同数はカラム名昇順
    expect(stats[0].tableCount).toBe(3);
    expect(stats.slice(0, 3).map((s) => s.columnName).sort()).toEqual([
      'id',
      'repo_name',
      'workspace_id',
    ]);
  });
});

describe('getMultiTableColumns', () => {
  it('閾値未満のカラムは除外する', () => {
    const tables: TableSchema[] = [
      { name: 't1', cols: [{ name: 'unique_col' }, { name: 'shared' }] },
      { name: 't2', cols: [{ name: 'shared' }] },
    ];
    const stats = computeColumnRelationStats(tables, []);
    const multi = getMultiTableColumns(stats, 2);
    expect(multi.map((s) => s.columnName)).toEqual(['shared']);
  });
});

describe('findMissingRelations', () => {
  it('id/created_at などのノイズは除外する', () => {
    const tables: TableSchema[] = [
      { name: 't1', cols: [{ name: 'id' }, { name: 'repo_name' }] },
      { name: 't2', cols: [{ name: 'id' }, { name: 'repo_name' }] },
    ];
    const stats = computeColumnRelationStats(tables, []);
    const missing = findMissingRelations(stats);
    expect(missing.map((s) => s.columnName)).toEqual(['repo_name']);
  });

  it('missing がゼロの場合は検出対象外', () => {
    const tables: TableSchema[] = [
      { name: 't1', cols: [{ name: 'repo_name' }] },
      { name: 't2', cols: [{ name: 'repo_name' }] },
    ];
    const rels: Relation[] = [
      ['t1', 'repo_name', 't2', 'repo_name', '多:多'],
    ];
    const stats = computeColumnRelationStats(tables, rels);
    const missing = findMissingRelations(stats);
    expect(missing).toEqual([]);
  });
});

describe('verifyColumnStats', () => {
  const tables: TableSchema[] = [
    { name: 't1', cols: [{ name: 'id' }, { name: 'repo_name' }, { name: 'user_id' }] },
    { name: 't2', cols: [{ name: 'id' }, { name: 'repo_name' }, { name: 'user_id' }] },
    { name: 't3', cols: [{ name: 'id' }, { name: 'repo_name' }] },
    { name: 't4', cols: [{ name: 'unique_col' }] },
  ];

  it('技術カラム (id) は technical 分類で acceptable', () => {
    const stats = computeColumnRelationStats(tables, []);
    const result = verifyColumnStats(stats, [], []);
    const id = result.find((r) => r.columnName === 'id')!;
    expect(id.classification).toBe('technical');
    expect(id.acceptable).toBe(true);
  });

  it('物理FK が存在するカラムは physical-fk 分類', () => {
    const stats = computeColumnRelationStats(tables, []);
    const physRels: Relation[] = [
      ['t1', 'repo_name', 't2', 'repo_name', '多:多'],
    ];
    const result = verifyColumnStats(stats, physRels, []);
    const repoName = result.find((r) => r.columnName === 'repo_name')!;
    expect(repoName.classification).toBe('physical-fk');
    expect(repoName.physicalFkCount).toBe(1);
    expect(repoName.acceptable).toBe(true);
  });

  it('論理FKのみのカラムは logical-fk-only 分類で acceptable', () => {
    const stats = computeColumnRelationStats(tables, []);
    const logRels: Relation[] = [
      ['t1', 'repo_name', 't2', 'repo_name', '論理FK'],
    ];
    const result = verifyColumnStats(stats, [], logRels);
    const repoName = result.find((r) => r.columnName === 'repo_name')!;
    expect(repoName.classification).toBe('logical-fk-only');
    expect(repoName.logicalFkCount).toBe(1);
    expect(repoName.acceptable).toBe(true);
  });

  it('物理FKも論理FKも無いドメインカラムは unmapped 分類で acceptable=false', () => {
    const stats = computeColumnRelationStats(tables, []);
    const result = verifyColumnStats(stats, [], []);
    const userId = result.find((r) => r.columnName === 'user_id')!;
    expect(userId.classification).toBe('unmapped');
    expect(userId.acceptable).toBe(false);
  });

  it('1テーブルにしか出現しないカラムは singleton 分類', () => {
    const stats = computeColumnRelationStats(tables, []);
    const result = verifyColumnStats(stats, [], []);
    const unique = result.find((r) => r.columnName === 'unique_col')!;
    expect(unique.classification).toBe('singleton');
    expect(unique.acceptable).toBe(true);
  });

  it('注釈 (annotation) が全カラムで空でない文字列', () => {
    const stats = computeColumnRelationStats(tables, []);
    const result = verifyColumnStats(stats, [], []);
    for (const r of result) {
      expect(r.annotation).toBeTypeOf('string');
      expect(r.annotation.length).toBeGreaterThan(0);
    }
  });
});
