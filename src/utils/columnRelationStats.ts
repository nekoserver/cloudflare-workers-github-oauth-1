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

/**
 * 技術カラムのデフォルトリスト。ドメイン相関を持たないがよくある共通カラム。
 * （カラム別分類 "technical" の判定に使う）
 */
export const DEFAULT_TECHNICAL_COLUMNS = [
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
];

/**
 * カラムの分類。ER図との差分を「エラーか / 仕様内か」で判断するために使う。
 *
 * - physical-fk: 物理FK (PRAGMA foreign_key_list) が最低1本存在する
 * - logical-fk-only: 物理FKは無いが COLUMN_FK_TARGETS 相当の論理FKが定義されている
 * - technical: id/created_at 等の技術カラム（相関を期待しない）
 * - unmapped: 同名カラムだが物理FKも論理FKも未定義（検討の余地あり）
 * - singleton: 1テーブルにしか出現しない（相関対象外）
 */
export type ColumnClassification =
  | 'physical-fk'
  | 'logical-fk-only'
  | 'technical'
  | 'unmapped'
  | 'singleton';

export interface ColumnVerification {
  columnName: string;
  tableCount: number;
  tables: string[];
  physicalFkCount: number;
  logicalFkCount: number;
  classification: ColumnClassification;
  /** UI 表示用の日本語注釈 */
  annotation: string;
  /** missing が存在しても仕様上許容できる場合は true */
  acceptable: boolean;
}

/**
 * 物理FKと論理FKを個別のリレーション配列として受け取り、
 * カラム名ごとに分類と注釈を作成する。
 *
 * - physicalRelations: `PRAGMA foreign_key_list` で取得した DB 制約ベースの FK
 * - logicalRelations: `COLUMN_FK_TARGETS` から合成した論理FK
 */
export function verifyColumnStats(
  stats: ColumnStat[],
  physicalRelations: Relation[],
  logicalRelations: Relation[],
  technicalColumns: string[] = DEFAULT_TECHNICAL_COLUMNS,
): ColumnVerification[] {
  const tech = new Set(technicalColumns);
  const physCounts = countRelationsByColumnName(physicalRelations);
  const logCounts = countRelationsByColumnName(logicalRelations);

  return stats.map((s) => {
    const physicalFkCount = physCounts.get(s.columnName) ?? 0;
    const logicalFkCount = logCounts.get(s.columnName) ?? 0;

    let classification: ColumnClassification;
    let annotation: string;
    let acceptable = true;

    if (s.tableCount <= 1) {
      classification = 'singleton';
      annotation = '1テーブルにしか出現しないためリレーション対象外。';
    } else if (tech.has(s.columnName)) {
      classification = 'technical';
      annotation =
        '技術カラム（id / created_at 等）。ドメイン相関を持たないため矢印不足は仕様通り。';
    } else if (physicalFkCount > 0) {
      classification = 'physical-fk';
      annotation = `物理FK (${physicalFkCount} 本) が DB 制約として存在する。`;
    } else if (logicalFkCount > 0) {
      classification = 'logical-fk-only';
      annotation = `物理FKは無いが、COLUMN_FK_TARGETS で論理FK (${logicalFkCount} 本) として定義済み。DB制約はあえて設けていない（CASCADE副作用を避ける等の意図）。`;
    } else {
      classification = 'unmapped';
      annotation =
        '同名カラムで複数テーブルに出現するが、物理FK・論理FK どちらも未定義。意図的に相関させない設計か、COLUMN_FK_TARGETS 登録漏れの可能性あり。';
      acceptable = false;
    }

    return {
      columnName: s.columnName,
      tableCount: s.tableCount,
      tables: s.tables,
      physicalFkCount,
      logicalFkCount,
      classification,
      annotation,
      acceptable,
    };
  });
}
