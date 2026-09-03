// /cf-dashboard ページが使うD1テーブル一覧・行数取得ロジック。
// 以前はCloudflare REST API(CLOUDFLARE_API_TOKEN必須、アカウント全体のD1
// データベース一覧を取得できる)経由で実装していたが、トークンの権限設定
// ミスにより401エラーが頻発したため、このWorker自身のD1バインディング
// (c.env.DB、トークン不要で常に動作する)経由に切り替えた。
// トレードオフとして「アカウント全体のD1一覧」ではなく「このWorkerが
// 使っているD1データベース1つ」の情報しか取得できなくなる。

export type CfD1TableInfo = { name: string; row_count: number | null };

const LIST_TABLES_SQL =
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name";

export async function listD1TableNames(db: D1Database): Promise<string[]> {
  const rows = await db.prepare(LIST_TABLES_SQL).all<{ name: string }>();
  return (rows.results ?? []).map((r) => r.name);
}

/**
 * テーブルごとの行数取得は他テーブルの失敗に影響されないよう、
 * 1テーブルずつtry/catchする(壊れたテーブルが1つあっても他は表示できる)。
 */
export async function loadCfDashboardTables(db: D1Database): Promise<CfD1TableInfo[]> {
  const names = await listD1TableNames(db);
  const tables: CfD1TableInfo[] = [];
  for (const name of names) {
    let rowCount: number | null = null;
    try {
      const countRows = await db.prepare(`SELECT COUNT(*) as cnt FROM "${name}"`).all<{ cnt: number }>();
      const cnt = countRows.results?.[0]?.cnt;
      rowCount = typeof cnt === 'number' ? cnt : null;
    } catch {
      rowCount = null;
    }
    tables.push({ name, row_count: rowCount });
  }
  return tables;
}
