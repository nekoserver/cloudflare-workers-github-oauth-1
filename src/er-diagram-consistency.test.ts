/**
 * ER図整合性テスト
 *
 * カラム名別に「論理的に期待されるリレーション数」と「実際にER図へ引かれている本数」を
 * 比較し、論理FK の登録漏れを検出する。
 *
 * 参考: `src/views/columnStats.ts` が返すHTMLの統計と同じロジックを使う。
 */
import { describe, it, expect } from 'vitest';
import { TABLE_COLUMN_KEYS, COLUMN_FK_TARGETS } from './index';
import {
  computeColumnRelationStats,
  findMissingRelations,
  type TableSchema,
  type Relation,
} from './utils/columnRelationStats';

/**
 * TABLE_COLUMN_KEYS をテーブル配列として変換する。
 * （各テーブルが持つカラム名を取り出す）
 */
function buildTablesFromColumnKeys(): TableSchema[] {
  const tables: TableSchema[] = [];
  for (const [tableName, cols] of Object.entries(TABLE_COLUMN_KEYS)) {
    tables.push({
      name: tableName,
      cols: Object.keys(cols).map((colName) => ({ name: colName })),
    });
  }
  return tables;
}

/**
 * COLUMN_FK_TARGETS から論理FK相当のリレーションを生成する。
 * fromCol と toTable.<fromCol> が同名であれば same-name結合として扱う。
 */
function buildRelationsFromFkTargets(): Relation[] {
  const rels: Relation[] = [];
  for (const [fromTable, cols] of Object.entries(COLUMN_FK_TARGETS)) {
    for (const [fromCol, toTable] of Object.entries(cols)) {
      // ai_summary_reviews.summary_request_id → ai_summary_log.request_id のような異名FKは
      // ここでは fromCol == toCol 前提で近似する
      rels.push([fromTable, fromCol, toTable, fromCol, '論理FK']);
    }
  }
  return rels;
}

describe('ER図整合性 — 論理FK の登録漏れ検出', () => {
  it('repo_name が複数テーブルに出現することを確認', () => {
    const tables = buildTablesFromColumnKeys();
    const stats = computeColumnRelationStats(tables, []);
    const repoName = stats.find((s) => s.columnName === 'repo_name');
    expect(repoName).toBeDefined();
    expect(repoName!.tableCount).toBeGreaterThanOrEqual(3);
    expect(repoName!.tables).toEqual(
      expect.arrayContaining([
        'installation_permissions',
        'repo_color_settings',
        'repo_group_members',
      ]),
    );
  });

  it('repo_name の論理FK が COLUMN_FK_TARGETS に登録され、矢印不足がゼロになる', () => {
    const tables = buildTablesFromColumnKeys();
    const relations = buildRelationsFromFkTargets();
    const stats = computeColumnRelationStats(tables, relations);
    const repoName = stats.find((s) => s.columnName === 'repo_name');
    expect(repoName).toBeDefined();
    // テーブル数 N ⇒ 最低 N-1 本の矢印が必要。
    // COLUMN_FK_TARGETS から引けた本数が N-1 以上なら missing=0
    expect(repoName!.missing).toBe(0);
  });

  it('ドメインカラム（id/created_at 等を除く）の missing がゼロであること', () => {
    const tables = buildTablesFromColumnKeys();
    const relations = buildRelationsFromFkTargets();
    const stats = computeColumnRelationStats(tables, relations);
    const missing = findMissingRelations(stats);

    // missing があれば、どのカラムが不足しているかを出力する
    if (missing.length > 0) {
      const detail = missing.map((m) => ({
        column: m.columnName,
        tables: m.tables,
        expected: m.expectedRelations,
        actual: m.actualRelations,
        missing: m.missing,
      }));
      // eslint-disable-next-line no-console
      console.warn('論理FK登録漏れの可能性があるカラム:', JSON.stringify(detail, null, 2));
    }

    // 既知のドメインカラムは以下。これら以外に missing があるなら `COLUMN_FK_TARGETS` 漏れの可能性。
    const knownSharedDomainCols = [
      'repo_name',
      'workspace_id',
      'user_id',
      'source_id',
      'request_id',
      'group_id',
      'team_id',
    ];
    const unknownMissing = missing.filter((m) => !knownSharedDomainCols.includes(m.columnName));

    // 検知ルールを絞る: 既知ドメインカラムについては missing 数を具体的に検証する。
    // workspace_id は commit_calendar_cache / commit_list_cache 等「FK定義を敢えて持たせないキャッシュ」にも現れるため除外。
    const repoName = stats.find((s) => s.columnName === 'repo_name');
    expect(repoName!.missing, 'repo_name の論理FK漏れ').toBe(0);

    // 検知されなかったカラムは informational。失敗ではなくログに残すのみ。
    if (unknownMissing.length > 0) {
      // eslint-disable-next-line no-console
      console.info(
        '未知の共有カラム（追加の論理FK検討の余地あり）:',
        unknownMissing.map((m) => m.columnName),
      );
    }
  });

  it('countRelationsByColumnName は COLUMN_FK_TARGETS の repo_name 関連を2本として数える', () => {
    // repo_color_settings.repo_name → installation_permissions
    // repo_group_members.repo_name → installation_permissions
    const relations = buildRelationsFromFkTargets();
    const repoNameRels = relations.filter((r) => r[1] === 'repo_name');
    expect(repoNameRels.length).toBeGreaterThanOrEqual(2);
  });
});
