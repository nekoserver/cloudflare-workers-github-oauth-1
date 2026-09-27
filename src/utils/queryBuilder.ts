/**
 * /query-builder(「どのテーブル・どのカラムに対してどう取り出すか」を選択式で
 * 組み立てるページ)の中核ロジック。D1の`.bind()`は値しかパラメータ化できず
 * テーブル名・カラム名はSQL文字列へ直接埋め込むしかないため、テーブル名・
 * カラム名は必ず呼び出し元が用意した許可リスト(STATUS_TABLE_DEFINITIONS由来・
 * PRAGMA table_infoで取得した実カラム一覧)に含まれる値だけを受け付ける。
 * 値側(WHERE句の比較値・LIMIT等)は例外なく`.bind()`パラメータにする。
 * 自由入力のSQL文字列は一切受け付けない(CLAUDE.mdの方針: 選択式のみ許可)。
 */

export type FilterOp = 'eq' | 'neq' | 'like' | 'in' | 'is_null' | 'is_not_null' | 'between';

export type Filter =
  | { column: string; op: 'eq' | 'neq' | 'like'; value: string }
  | { column: string; op: 'in'; values: string[] }
  | { column: string; op: 'is_null' | 'is_not_null' }
  | { column: string; op: 'between'; from: string; to: string };

export type OrderBy = { column: string; direction: 'asc' | 'desc' };

export type QuerySpec = {
  table: string;
  mode: 'rows' | 'aggregate';
  columns: string[];
  filters: Filter[];
  orderBy?: OrderBy;
  groupByColumn?: string;
  havingCountOp?: 'gte' | 'lte' | 'eq';
  havingCountValue?: number;
  limit: number;
};

export type BuiltQuery = { sql: string; params: Array<string | number> };

export type BuildQueryResult =
  | { ok: true; value: BuiltQuery }
  | { ok: false; errorCode: string; detail: string };

const MAX_LIMIT = 200;
const MAX_IN_VALUES = 50;
const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function ng(errorCode: string, detail: string): BuildQueryResult {
  return { ok: false, errorCode, detail };
}

function isAllowedIdentifier(name: unknown, allowed: string[]): name is string {
  return typeof name === 'string' && IDENTIFIER_RE.test(name) && allowed.includes(name);
}

function buildFilterClause(filter: Filter, allowedColumns: string[]): { sql: string; params: Array<string | number> } | { error: string } {
  if (!isAllowedIdentifier(filter.column, allowedColumns)) {
    return { error: `カラム「${String((filter as { column?: unknown }).column)}」は許可されていません` };
  }
  const col = filter.column;
  switch (filter.op) {
    case 'eq':
      return { sql: `${col} = ?`, params: [filter.value] };
    case 'neq':
      return { sql: `${col} <> ?`, params: [filter.value] };
    case 'like':
      return { sql: `${col} LIKE ?`, params: [`%${filter.value}%`] };
    case 'is_null':
      return { sql: `${col} IS NULL`, params: [] };
    case 'is_not_null':
      return { sql: `${col} IS NOT NULL`, params: [] };
    case 'in': {
      const values = filter.values;
      if (!Array.isArray(values) || values.length < 1 || values.length > MAX_IN_VALUES) {
        return { error: `カラム「${col}」のIN句は1〜${MAX_IN_VALUES}件で指定してください` };
      }
      return { sql: `${col} IN (${values.map(() => '?').join(', ')})`, params: values };
    }
    case 'between':
      return { sql: `${col} BETWEEN ? AND ?`, params: [filter.from, filter.to] };
    default:
      return { error: `カラム「${col}」の演算子が不正です` };
  }
}

/**
 * 選択式で組み立てたクエリ仕様(QuerySpec)を、許可されたテーブル名・カラム名の
 * 範囲内でのみ検証し、パラメータ化されたSQLへ変換する。
 * table・allowedColumns は呼び出し元(ルートハンドラ)がSTATUS_TABLE_DEFINITIONSと
 * 実際のPRAGMA table_infoの両方で確認済みの値を渡す前提(このファイル単体では
 * テーブルの実在確認はしない)。
 */
export function buildQuery(spec: QuerySpec, allowedColumns: string[]): BuildQueryResult {
  if (!spec || typeof spec !== 'object') return ng('NOT_OBJECT', '仕様がオブジェクトではありません');
  if (!isAllowedIdentifier(spec.table, [spec.table]) || typeof spec.table !== 'string') {
    // テーブル名自体の許可リスト照合はルートハンドラの責務。ここでは識別子として
    // 安全な形であることだけをチェックする(念のための二重チェック)。
    return ng('BAD_TABLE', 'テーブル名が不正です');
  }
  if (!Array.isArray(allowedColumns) || allowedColumns.length === 0) {
    return ng('NO_COLUMNS', 'このテーブルのカラム一覧を取得できませんでした');
  }
  const limit = spec.limit;
  if (typeof limit !== 'number' || !Number.isFinite(limit) || !Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return ng('BAD_LIMIT', `件数は1〜${MAX_LIMIT}で指定してください`);
  }

  const filters = Array.isArray(spec.filters) ? spec.filters : [];
  const whereParts: string[] = [];
  const whereParams: Array<string | number> = [];
  for (const filter of filters) {
    const built = buildFilterClause(filter, allowedColumns);
    if ('error' in built) return ng('BAD_FILTER', built.error);
    whereParts.push(built.sql);
    whereParams.push(...built.params);
  }
  const whereClause = whereParts.length > 0 ? ` WHERE ${whereParts.join(' AND ')}` : '';

  if (spec.mode === 'aggregate') {
    if (!isAllowedIdentifier(spec.groupByColumn, allowedColumns)) {
      return ng('BAD_GROUP_BY', 'GROUP BY対象のカラムが不正です');
    }
    const groupCol = spec.groupByColumn as string;
    let havingClause = '';
    const havingParams: Array<string | number> = [];
    if (spec.havingCountOp !== undefined || spec.havingCountValue !== undefined) {
      const opMap = { gte: '>=', lte: '<=', eq: '=' } as const;
      const havingOp = spec.havingCountOp;
      if (!havingOp || !(havingOp in opMap)) return ng('BAD_HAVING', 'HAVINGの演算子が不正です');
      if (typeof spec.havingCountValue !== 'number' || !Number.isFinite(spec.havingCountValue)) {
        return ng('BAD_HAVING', 'HAVINGの比較値が不正です');
      }
      havingClause = ` HAVING COUNT(*) ${opMap[havingOp]} ?`;
      havingParams.push(spec.havingCountValue);
    }
    const sql = `SELECT ${groupCol}, COUNT(*) AS cnt FROM ${spec.table}${whereClause} GROUP BY ${groupCol}${havingClause} LIMIT ?`;
    return { ok: true, value: { sql, params: [...whereParams, ...havingParams, limit] } };
  }

  const columns = Array.isArray(spec.columns) ? spec.columns : [];
  if (columns.length < 1 || columns.length > allowedColumns.length) {
    return ng('BAD_COLUMNS', '表示するカラムを1つ以上、重複なく選んでください');
  }
  if (new Set(columns).size !== columns.length) return ng('BAD_COLUMNS', 'カラムが重複しています');
  for (const c of columns) {
    if (!isAllowedIdentifier(c, allowedColumns)) return ng('BAD_COLUMNS', `カラム「${String(c)}」は許可されていません`);
  }

  let orderClause = '';
  if (spec.orderBy) {
    if (!isAllowedIdentifier(spec.orderBy.column, allowedColumns)) return ng('BAD_ORDER_BY', 'ORDER BY対象のカラムが不正です');
    if (spec.orderBy.direction !== 'asc' && spec.orderBy.direction !== 'desc') return ng('BAD_ORDER_BY', 'ORDER BYの向きが不正です');
    orderClause = ` ORDER BY ${spec.orderBy.column} ${spec.orderBy.direction.toUpperCase()}`;
  }

  const sql = `SELECT ${columns.join(', ')} FROM ${spec.table}${whereClause}${orderClause} LIMIT ?`;
  return { ok: true, value: { sql, params: [...whereParams, limit] } };
}
