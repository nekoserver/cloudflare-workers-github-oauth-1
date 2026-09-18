/**
 * APIキー(nkapi_...)単位のエンドポイント別・日別(JST)アクセス集計。
 * 記録はミドルウェア(fire-and-forget)から、集計はサマリー生成用の
 * 純粋関数(summarizeApiKeyUsage)を経由して🔑キー管理ページの使用統計表示に
 * 使う(CLAUDE.mdルール15: テスト対象のロジックはDBアクセスと分離した
 * 純粋関数に切り出す)。
 */
import { getJstDateYmdHyphen } from './aichatSlashCommand';

export interface ApiKeyStatsDb {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      run(): Promise<unknown>;
    };
  };
}

/**
 * APIキー1回分のアクセスを、そのキー・その日(JST)・エンドポイント・
 * ステータスコードの組み合わせで1行に積み上げる(fire-and-forget想定、
 * 呼び出し元でcatchすること)。
 */
export async function recordApiKeyEndpointAccess(
  db: ApiKeyStatsDb,
  keyId: string,
  method: string,
  routePath: string,
  statusCode: number,
  now: Date = new Date(),
): Promise<void> {
  if (!keyId || !routePath) return;
  const day = getJstDateYmdHyphen(now);
  const endpoint = `${method} ${routePath}`;
  await db.prepare(
    `INSERT INTO api_key_endpoint_stats (key_id, day, endpoint, status_code, count, last_called_at)
     VALUES (?, ?, ?, ?, 1, datetime('now'))
     ON CONFLICT(key_id, day, endpoint, status_code) DO UPDATE SET
       count = count + 1,
       last_called_at = datetime('now')`
  ).bind(keyId, day, endpoint, statusCode).run();
}

export type ApiKeyEndpointStatRow = { day: string; endpoint: string; status_code: number; count: number };

export type ApiKeyUsageSummary = {
  totalCount: number;
  byEndpoint: { endpoint: string; count: number }[];
  byDay: { day: string; count: number }[];
  byMonth: { month: string; count: number }[];
};

/**
 * api_key_endpoint_statsの生の行(1キー分)を、エンドポイント別・日別・月別の
 * 件数合計に集計する。DBアクセスを含まない純粋関数。
 */
export function summarizeApiKeyUsage(rows: ApiKeyEndpointStatRow[]): ApiKeyUsageSummary {
  const totalCount = rows.reduce((sum, r) => sum + r.count, 0);
  const byEndpointMap = new Map<string, number>();
  const byDayMap = new Map<string, number>();
  const byMonthMap = new Map<string, number>();
  for (const r of rows) {
    byEndpointMap.set(r.endpoint, (byEndpointMap.get(r.endpoint) ?? 0) + r.count);
    byDayMap.set(r.day, (byDayMap.get(r.day) ?? 0) + r.count);
    const month = r.day.slice(0, 7);
    byMonthMap.set(month, (byMonthMap.get(month) ?? 0) + r.count);
  }
  const byEndpoint = Array.from(byEndpointMap, ([endpoint, count]) => ({ endpoint, count }))
    .sort((a, b) => b.count - a.count);
  const byDay = Array.from(byDayMap, ([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));
  const byMonth = Array.from(byMonthMap, ([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
  return { totalCount, byEndpoint, byDay, byMonth };
}
