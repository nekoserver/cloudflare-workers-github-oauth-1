export const FIREWALL_HISTORY_SQL = `SELECT id, collected_at, available,
  json_extract(snapshot_json, '$.mode') AS mode,
  json_extract(snapshot_json, '$.counterEpoch') AS counter_epoch,
  json_extract(snapshot_json, '$.sourceCount') AS source_count,
  json_extract(snapshot_json, '$.error') AS error,
  (SELECT COALESCE(SUM(json_extract(value, '$.packets')), 0) FROM json_each(snapshot_json, '$.prefixTotals')) AS packets,
  (SELECT COALESCE(SUM(json_extract(value, '$.bytes')), 0) FROM json_each(snapshot_json, '$.prefixTotals')) AS bytes
  FROM cf_container_firewall_snapshots
  WHERE container_name = ? AND collected_at >= ? AND collected_at < ? AND id < ?
  ORDER BY id DESC LIMIT ?`;

export function firewallHistoryRange(query: URLSearchParams, now = new Date()) {
  const to = new Date(query.get('to') || now.toISOString());
  const from = new Date(query.get('from') || new Date(to.getTime() - 86400000).toISOString());
  const limit = Number(query.get('limit') || 168);
  const before = Number(query.get('before') || Number.MAX_SAFE_INTEGER);
  if (!Number.isFinite(to.getTime()) || !Number.isFinite(from.getTime()) || from >= to
      || to.getTime() - from.getTime() > 31 * 86400000
      || !Number.isSafeInteger(limit) || limit < 1 || limit > 744
      || !Number.isSafeInteger(before) || before < 1) {
    throw new Error('期間は31日以内、件数は1〜744で指定してください');
  }
  return { from: from.toISOString(), to: to.toISOString(), limit, before };
}

export async function listFirewallHistory(db: D1Database, range: ReturnType<typeof firewallHistoryRange>) {
  const result = await db.prepare(FIREWALL_HISTORY_SQL)
    .bind('nekoroot', range.from, range.to, range.before, range.limit).all();
  return { rows: result.results ?? [], nextBefore: result.results?.length === range.limit ? result.results.at(-1)?.id : null };
}

export async function getFirewallHistorySnapshot(db: D1Database, id: number) {
  const row = await db.prepare(`SELECT id, collected_at, snapshot_json FROM cf_container_firewall_snapshots
    WHERE container_name = ? AND id = ?`).bind('nekoroot', id)
    .first<{ id: number; collected_at: string; snapshot_json: string }>();
  if (!row) return null;
  return { id: row.id, collectedAt: row.collected_at, snapshot: JSON.parse(row.snapshot_json) };
}
