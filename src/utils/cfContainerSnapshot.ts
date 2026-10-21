/**
 * /cf-containersのヘルスチェックごとの記録(cf_container_snapshots)と、前回の記録との差分
 * (cf_container_snapshot_diffs)。画面の「前回との差分」と、6時間cronの版の報告に使う。
 */
import type { LatestToolVersion } from './latestToolVersions';

export type SnapshotValues = {
  runningContainers: number | null;
  connectedSeconds: number | null;
  estimatedCostUsd: number | null;
  imageCommit: string | null;
  versions: Record<string, string | null>;
};

export type SnapshotRecord = SnapshotValues & { id: number; createdAt: string };

export type SnapshotDiff = { metric: string; before: string | null; after: string | null; delta: number | null };

/** 前回の記録との差分。数値は増分、コミットと版は変わったものだけを返す。 */
export function computeSnapshotDiffs(prev: SnapshotValues | null, cur: SnapshotValues): SnapshotDiff[] {
  if (!prev) return [];
  const diffs: SnapshotDiff[] = [];
  const numeric: Array<['running_containers' | 'connected_seconds' | 'estimated_cost_usd', number | null, number | null]> = [
    ['running_containers', prev.runningContainers, cur.runningContainers],
    ['connected_seconds', prev.connectedSeconds, cur.connectedSeconds],
    ['estimated_cost_usd', prev.estimatedCostUsd, cur.estimatedCostUsd],
  ];
  for (const [metric, before, after] of numeric) {
    if (before !== null && after !== null && before !== after) {
      diffs.push({ metric, before: String(before), after: String(after), delta: after - before });
    }
  }
  if (prev.imageCommit && cur.imageCommit && prev.imageCommit !== cur.imageCommit) {
    diffs.push({ metric: 'image_commit', before: prev.imageCommit, after: cur.imageCommit, delta: null });
  }
  const names = new Set([...Object.keys(prev.versions), ...Object.keys(cur.versions)]);
  for (const name of names) {
    const before = prev.versions[name] ?? null;
    const after = cur.versions[name] ?? null;
    if (before !== after) diffs.push({ metric: `version:${name}`, before, after, delta: null });
  }
  return diffs;
}

type SnapshotRow = {
  id: number;
  running_containers: number | null;
  connected_seconds: number | null;
  estimated_cost_usd: number | null;
  image_commit: string | null;
  versions_json: string | null;
  created_at: string;
};

function toRecord(row: SnapshotRow): SnapshotRecord {
  let versions: Record<string, string | null> = {};
  try {
    versions = row.versions_json ? JSON.parse(row.versions_json) : {};
  } catch {
    versions = {};
  }
  return {
    id: row.id,
    createdAt: row.created_at,
    runningContainers: row.running_containers,
    connectedSeconds: row.connected_seconds,
    estimatedCostUsd: row.estimated_cost_usd,
    imageCommit: row.image_commit,
    versions,
  };
}

const SELECT_COLUMNS = 'id, running_containers, connected_seconds, estimated_cost_usd, image_commit, versions_json, created_at';

/** cronの記録に使うuser_id(ユーザーではないため、user_sessionsには存在しない)。 */
export const CRON_SNAPSHOT_USER_ID = 'system:cron';

/** 版を持つ最新の記録(画面のヘルスチェックで記録されたもの。cronの記録は除く)。 */
export async function getLatestVersionSnapshot(db: D1Database): Promise<SnapshotRecord | null> {
  const row = await db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM cf_container_snapshots WHERE user_id != ? AND versions_json IS NOT NULL AND versions_json != '{}' ORDER BY id DESC LIMIT 1`)
    .bind(CRON_SNAPSHOT_USER_ID)
    .first<SnapshotRow>();
  return row ? toRecord(row) : null;
}

/** 6時間cronの報告文の頭(稼働数と前回cronからの変化)。 */
export function buildCronHeader(cur: SnapshotValues, diffs: SnapshotDiff[]): string {
  const d = (metric: string) => diffs.find((x) => x.metric === metric)?.delta ?? 0;
  return [
    `稼働中のコンテナ: ${cur.runningContainers ?? '取得できず'}`,
    `累計接続時間: ${cur.connectedSeconds ?? '?'}秒(前回cronから +${d('connected_seconds')}秒)`,
    `予定支出: $${cur.estimatedCostUsd?.toFixed(4) ?? '?'}(前回cronから +$${d('estimated_cost_usd').toFixed(4)})`,
  ].join('\n');
}

/** 指定ユーザーの最新の記録(userIdを省くと全体の最新)。 */
export async function getLatestSnapshot(db: D1Database, userId?: string): Promise<SnapshotRecord | null> {
  const row = userId
    ? await db.prepare(`SELECT ${SELECT_COLUMNS} FROM cf_container_snapshots WHERE user_id = ? ORDER BY id DESC LIMIT 1`).bind(userId).first<SnapshotRow>()
    : await db.prepare(`SELECT ${SELECT_COLUMNS} FROM cf_container_snapshots ORDER BY id DESC LIMIT 1`).first<SnapshotRow>();
  return row ? toRecord(row) : null;
}

/** 今回の値を記録し、前回の記録との差分を別テーブルに残す。前回の記録と差分を返す。 */
export async function recordSnapshot(
  db: D1Database,
  userId: string,
  cur: SnapshotValues,
  now = new Date()
): Promise<{ id: number; previous: SnapshotRecord | null; diffs: SnapshotDiff[] }> {
  const previous = await getLatestSnapshot(db, userId);
  const inserted = await db
    .prepare(
      'INSERT INTO cf_container_snapshots (user_id, prev_snapshot_id, running_containers, connected_seconds, estimated_cost_usd, image_commit, versions_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id'
    )
    .bind(userId, previous?.id ?? null, cur.runningContainers, cur.connectedSeconds, cur.estimatedCostUsd, cur.imageCommit, JSON.stringify(cur.versions), now.toISOString())
    .first<{ id: number }>();
  if (!inserted) throw new Error('cf_container_snapshotsへの記録に失敗しました(idが返りません)');
  const diffs = computeSnapshotDiffs(previous, cur);
  if (diffs.length) {
    await db.batch(
      diffs.map((d) =>
        db
          .prepare('INSERT INTO cf_container_snapshot_diffs (snapshot_id, metric, before_value, after_value, delta) VALUES (?, ?, ?, ?, ?)')
          .bind(inserted.id, d.metric, d.before, d.after, d.delta)
      )
    );
  }
  return { id: inserted.id, previous, diffs };
}

const compare = (a: string, b: string) => {
  const pa = a.split(/\D+/).filter(Boolean).map(Number);
  const pb = b.split(/\D+/).filter(Boolean).map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
};

/** 6時間cronでSlackに送る報告文。最後に記録された版と配布元の最新を並べる。 */
export function buildVersionReport(
  last: { createdAt: string; versions: Record<string, string | null> } | null,
  latest: Partial<Record<string, LatestToolVersion>>
): string {
  if (!last) {
    return 'コンテナの版の記録がまだありません。/cf-containersでヘルスチェックを実行すると記録されます。';
  }
  const lines: string[] = [];
  let newer = 0;
  for (const name of Object.keys(latest)) {
    const info = latest[name]!;
    const current = last.versions[name] ?? null;
    if (!current) {
      lines.push(`${name}: 記録なし(最新 ${info.latest ?? '取得できず'})`);
    } else if (!info.latest) {
      lines.push(`${name}: ${current}(最新の取得に失敗: ${info.error ?? '不明'})`);
    } else if (compare(info.latest, current) > 0) {
      newer++;
      lines.push(`${name}: ${current} → 新版 ${info.latest}`);
    } else {
      lines.push(`${name}: ${current}(最新)`);
    }
  }
  return [`新版あり: ${newer}件(版の記録: ${last.createdAt})`, ...lines].join('\n');
}

/** 6時間レポートをSlackへ送るか(notification_settings.cf_containers_report_slack、既定はON)。 */
export async function getCronReportSlackEnabled(db: D1Database): Promise<boolean> {
  const row = await db
    .prepare('SELECT cf_containers_report_slack FROM notification_settings WHERE id = 1')
    .first<{ cf_containers_report_slack: number | null }>();
  return row ? row.cf_containers_report_slack !== 0 : true;
}

export async function setCronReportSlackEnabled(db: D1Database, enabled: boolean, now = new Date()): Promise<void> {
  await db
    .prepare(
      `INSERT INTO notification_settings (id, cf_containers_report_slack, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET cf_containers_report_slack = excluded.cf_containers_report_slack, updated_at = excluded.updated_at`
    )
    .bind(enabled ? 1 : 0, now.toISOString())
    .run();
}
