export type HeritageSeedSourceItem = {
  e: string;
  f: string;
  n: string;
  c: string;
  t: string;
  y: number | '----';
  lat: number;
  lon: number;
};

export type HeritageMasterRow = {
  id: string;
  flag: string;
  country_name: string;
  heritage_name: string;
  lat: number;
  lon: number;
  registered_year: number;
  category: string;
  classification_icon: string;
  free_icon: string;
};

export const HERITAGE_MASTER_CREATED_AT = '2026-08-20 00:00:00';

export function zeroPad4(n: number): string {
  return String(n).padStart(4, '0');
}

export function buildHeritageMasterRows(items: HeritageSeedSourceItem[]): HeritageMasterRow[] {
  return items.map((item, index) => ({
    id: zeroPad4(index + 1),
    flag: item.f,
    country_name: item.c,
    heritage_name: item.n,
    lat: item.lat,
    lon: item.lon,
    registered_year: item.y === '----' ? 0 : item.y,
    category: item.t,
    classification_icon: item.e,
    free_icon: '🏛️',
  }));
}

export function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

export function rowToSqlValues(row: HeritageMasterRow): string {
  return (
    `('${row.id}', '${escapeSqlString(row.flag)}', '${escapeSqlString(row.country_name)}', ` +
    `'${escapeSqlString(row.heritage_name)}', ${row.lat}, ${row.lon}, ${row.registered_year}, ` +
    `'${escapeSqlString(row.category)}', '${escapeSqlString(row.classification_icon)}', ` +
    `'${escapeSqlString(row.free_icon)}', NULL, NULL, 'heritageList.ts', ` +
    `'${HERITAGE_MASTER_CREATED_AT}', '${HERITAGE_MASTER_CREATED_AT}', NULL)`
  );
}

export function buildHeritageMasterInsertStatements(
  rows: HeritageMasterRow[],
  chunkSize: number
): string[] {
  const columns =
    '(id, flag, country_name, heritage_name, lat, lon, registered_year, category, ' +
    'classification_icon, free_icon, delete_mark, moved_to, source, created_at, updated_at, deleted_at)';
  const statements: string[] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const valuesSql = chunk.map(rowToSqlValues).join(',\n');
    statements.push(`INSERT INTO heritage_master ${columns} VALUES\n${valuesSql};`);
  }
  return statements;
}
