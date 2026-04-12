/**
 * カラム名別リレーション統計ユーティリティ
 *
 * 「同名カラムが複数テーブルに存在する」= 論理的に相関があるカラム、として集計する。
 * ER図に引かれた矢印の本数と比較して整合性を検証するための道具。
 *
 * 用途:
 * - `/status/column-stats` HTML ページでのカラム別相関数の可視化
 * - テストで「期待される矢印数」と「実際の矢印数」の差分を検出
 *
 * 故障想定:
 * - テーブル配列が空でも安全に空統計を返す
 * - 同じテーブル内の同名カラムは数えない（カラムは一意であるべきだが念のため）
 * - id や created_at のような全テーブル共通カラムも同じ扱いで集計する
 *   （ユーザーが閾値でフィルタする前提）
 */

export interface TableSchema {
  name: string;
  cols: { name: string; type?: string; keys?: string[] }[];
}

export type Relation = [string, string, string, string, string?];

export interface ColumnStat {
  /** カラム名 */
  columnName: string;
  /** このカラムを持つテーブルの一覧（ソート済み） */
  tables: string[];
  /** このカラムを持つテーブル数 */
  tableCount: number;
  /** 論理的に期待されるリレーション数（テーブル数 - 1、最小全域木相当） */
  expectedRelations: number;
  /** 実際に ER 図で引かれている矢印のうちこのカラム名に関するもの */
  actualRelations: number;
  /** expected と actual の差分（正なら未描画のリレーションが存在） */
  missing: number;
}

/**
 * テーブル一覧からカラム名別の出現テーブルを集計する。
 */
export function aggregateColumnTables(
  tables: TableSchema[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const tbl of tables) {
    if (!tbl || !tbl.cols) continue;
    for (const col of tbl.cols) {
      if (!col || !col.name) continue;
      if (!map.has(col.name)) map.set(col.name, new Set());
      map.get(col.name)!.add(tbl.name);
    }
  }
  return map;
}

/**
 * リレーション配列からカラム名別の出現本数を集計する。
 * リレーション `[fromTable, fromCol, toTable, toCol]` は from/to の両カラム名に 1 本ずつ加算する、
 * のではなく「1 本のリレーション」として片方を基準に集計する。
 *
 * ここでは `fromCol` と `toCol` が同名の場合のみそのカラム名に 1 本として加算する。
 * （repo_name → repo_name のような同名結合を想定）
 */
export function countRelationsByColumnName(
  relations: Relation[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const rel of relations) {
    if (!rel || rel.length < 4) continue;
    const fromCol = rel[1];
    const toCol = rel[3];
    if (fromCol && fromCol === toCol) {
      map.set(fromCol, (map.get(fromCol) ?? 0) + 1);
    } else {
      // 別名のFK（例: workspaces.team_id → teams.id）も集計対象にする
      // fromCol を基準にカウント
      if (fromCol) {
        map.set(fromCol, (map.get(fromCol) ?? 0) + 1);
      }
    }
  }
  return map;
}

/**
 * カラム名別の統計を算出する。
 * 「このカラム名が N 個のテーブルに出現 → N-1 本のリレーションが期待される」を基本とし、
 * 実際に ER 図に引かれている本数と比較する。
 */
export function computeColumnRelationStats(
  tables: TableSchema[],
  relations: Relation[],
): ColumnStat[] {
  const colTables = aggregateColumnTables(tables);
  const relCounts = countRelationsByColumnName(relations);
  const stats: ColumnStat[] = [];
  for (const [columnName, tableSet] of colTables.entries()) {
    const tableList = Array.from(tableSet).sort();
    const tableCount = tableList.length;
    const expectedRelations = Math.max(0, tableCount - 1);
    const actualRelations = relCounts.get(columnName) ?? 0;
    stats.push({
      columnName,
      tables: tableList,
      tableCount,
      expectedRelations,
      actualRelations,
      missing: Math.max(0, expectedRelations - actualRelations),
    });
  }
  // テーブル数 → カラム名 の順で降順ソート（リレーション数が多いカラム名を上位に）
  stats.sort((a, b) => {
    if (b.tableCount !== a.tableCount) return b.tableCount - a.tableCount;
    return a.columnName.localeCompare(b.columnName);
  });
  return stats;
}

/**
 * 統計結果から「リレーション数の多いカラム名」を threshold 以上で抽出する。
 * （デフォルト: 2テーブル以上に出現）
 */
export function getMultiTableColumns(
  stats: ColumnStat[],
  threshold = 2,
): ColumnStat[] {
  return stats.filter((s) => s.tableCount >= threshold);
}

/**
 * ER図の整合性チェック: 期待される最小リレーション本数に満たないカラムを列挙する。
 *
 * 「idnum PKなど全テーブル共通のカラム」は relation として結ばれない想定のため
 * `excludeColumns` で除外できる（デフォルト: id, created_at, updated_at など）。
 */
export function findMissingRelations(
  stats: ColumnStat[],
  excludeColumns: string[] = [
    'id',
    'created_at',
    'updated_at',
    'cached_at',
    'joined_at',
    'added_at',
    'last_updated_at',
    'event_date',
    'display_order',
    'description',
    'name',
    'notnull',
    'type',
    'pk',
  ],
): ColumnStat[] {
  const exclude = new Set(excludeColumns);
  return stats.filter((s) => !exclude.has(s.columnName) && s.missing > 0);
}
