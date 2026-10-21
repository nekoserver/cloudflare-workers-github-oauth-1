/** Hourly observations, including failures; counters are cumulative, not hourly traffic. */
export async function recordFirewallSnapshot(
  db: D1Database,
  collect: () => Promise<unknown>,
  now = new Date(),
): Promise<void> {
  let snapshot: Record<string, unknown>;
  try {
    const result = await collect();
    if (!result || typeof result !== 'object' || typeof (result as Record<string, unknown>).available !== 'boolean') {
      throw new Error('invalid_firewall_snapshot');
    }
    snapshot = result as Record<string, unknown>;
  } catch (error) {
    snapshot = { available: false, error: error instanceof Error ? error.message : 'collection_failed' };
  }
  let payload = JSON.stringify(snapshot);
  if (new TextEncoder().encode(payload).length > 900_000) {
    snapshot = { available: false, error: 'snapshot_too_large', sourceCount: snapshot.sourceCount };
    payload = JSON.stringify(snapshot);
  }
  await db.prepare(`INSERT INTO cf_container_firewall_snapshots
    (container_name, hour_utc, collected_at, available, snapshot_json) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(container_name, hour_utc) DO UPDATE SET
      collected_at = excluded.collected_at, available = excluded.available, snapshot_json = excluded.snapshot_json`)
    .bind('nekoroot', now.toISOString().slice(0, 13), now.toISOString(), snapshot.available === true ? 1 : 0, payload).run();
}
