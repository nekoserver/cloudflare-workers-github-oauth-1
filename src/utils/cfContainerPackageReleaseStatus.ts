import type { LatestToolVersions } from './latestToolVersions';
import type { SnapshotRecord } from './cfContainerSnapshot';

export type PackageReleaseStatus = {
  containerKey: string;
  packageName: string;
  installedVersion: string | null;
  installedStatus: 'installed' | 'not_detected' | 'not_recorded' | 'no_snapshot';
  latestVersion: string | null;
  latestReleaseAt: string | null;
  currentReleaseAt: string | null;
  releaseStatus: 'available' | 'failed' | 'unsupported';
  updateStatus: 'update_available' | 'current_or_ahead' | 'latest_unavailable' | 'unsupported' | 'not_detected' | 'unknown';
  source: string | null;
  error: string | null;
  installedSnapshotId: number | null;
  installedSnapshotAt: string | null;
  checkedAt: string;
};

function compareVersions(a: string, b: string): number {
  const left = a.split(/\D+/).filter(Boolean).map(Number);
  const right = b.split(/\D+/).filter(Boolean).map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const delta = (left[i] || 0) - (right[i] || 0);
    if (delta) return delta;
  }
  return 0;
}

export function buildPackageReleaseStatuses(
  containerKey: string,
  snapshot: SnapshotRecord | null,
  latest: LatestToolVersions,
  checkedAt: string,
): PackageReleaseStatus[] {
  const names = new Set([...Object.keys(latest), ...Object.keys(snapshot?.versions ?? {})]);
  return [...names].sort().map((packageName) => {
    const info = latest[packageName as keyof LatestToolVersions];
    const hasSnapshotEntry = !!snapshot && Object.prototype.hasOwnProperty.call(snapshot.versions, packageName);
    const installedVersion = hasSnapshotEntry ? snapshot!.versions[packageName] || null : null;
    const installedStatus: PackageReleaseStatus['installedStatus'] = !snapshot
      ? 'no_snapshot'
      : !hasSnapshotEntry ? 'not_recorded' : installedVersion ? 'installed' : 'not_detected';
    const releaseStatus: PackageReleaseStatus['releaseStatus'] = !info
      ? 'unsupported' : info.latest ? 'available' : 'failed';
    let updateStatus: PackageReleaseStatus['updateStatus'];
    if (installedStatus === 'no_snapshot' || installedStatus === 'not_recorded') updateStatus = 'unknown';
    else if (installedStatus === 'not_detected') updateStatus = 'not_detected';
    else if (!info) updateStatus = 'unsupported';
    else if (!info.latest) updateStatus = 'latest_unavailable';
    else updateStatus = compareVersions(info.latest, installedVersion!) > 0 ? 'update_available' : 'current_or_ahead';
    return {
      containerKey,
      packageName,
      installedVersion,
      installedStatus,
      latestVersion: info?.latest ?? null,
      latestReleaseAt: info?.latestReleasedAt ?? info?.latestDate ?? null,
      currentReleaseAt: info?.currentReleasedAt ?? info?.currentDate ?? null,
      releaseStatus,
      updateStatus,
      source: info?.source ?? null,
      error: info?.error ? info.error.slice(0, 500) : null,
      installedSnapshotId: snapshot?.id ?? null,
      installedSnapshotAt: snapshot?.createdAt ?? null,
      checkedAt,
    };
  });
}

// 確認の契機。health_check=/cf-containersのヘルスチェックを実行したとき、page_load=ページを開いたとき。
export type ReleaseCheckTrigger = 'health_check' | 'page_load';

// 未指定はpage_load(ページ表示時の既存の呼び出しは本文なし)。それ以外の値はnull(呼び出し元が400にする)。
export function parseReleaseCheckTrigger(value: unknown): ReleaseCheckTrigger | null {
  if (value === undefined) return 'page_load';
  return value === 'health_check' || value === 'page_load' ? value : null;
}

// 現在の状態(パッケージごとに1行・上書き)と、履歴(確認のたびに追記)を、同じバッチで確定する。
// 片方だけ反映されることがないよう、どちらかが失敗すれば両方とも反映しない。
export async function savePackageReleaseStatuses(db: D1Database, records: PackageReleaseStatus[], trigger: ReleaseCheckTrigger): Promise<void> {
  if (!records.length) return;
  const upserts = records.map((row) => db.prepare(`
    INSERT INTO cf_container_package_release_status (
      container_key, package_name, installed_version, installed_status,
      latest_version, latest_release_at, current_release_at,
      release_status, update_status, source, error,
      installed_snapshot_id, installed_snapshot_at, checked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(container_key, package_name) DO UPDATE SET
      installed_version = excluded.installed_version,
      installed_status = excluded.installed_status,
      latest_version = CASE WHEN excluded.release_status = 'available' THEN excluded.latest_version ELSE cf_container_package_release_status.latest_version END,
      latest_release_at = CASE WHEN excluded.release_status = 'available' THEN excluded.latest_release_at ELSE cf_container_package_release_status.latest_release_at END,
      current_release_at = CASE WHEN excluded.release_status = 'available' THEN excluded.current_release_at ELSE cf_container_package_release_status.current_release_at END,
      release_status = excluded.release_status,
      update_status = excluded.update_status,
      source = COALESCE(excluded.source, cf_container_package_release_status.source),
      error = excluded.error,
      installed_snapshot_id = excluded.installed_snapshot_id,
      installed_snapshot_at = excluded.installed_snapshot_at,
      checked_at = excluded.checked_at
  `).bind(
    row.containerKey, row.packageName, row.installedVersion, row.installedStatus,
    row.latestVersion, row.latestReleaseAt, row.currentReleaseAt,
    row.releaseStatus, row.updateStatus, row.source, row.error,
    row.installedSnapshotId, row.installedSnapshotAt, row.checkedAt,
  ));
  const history = records.map((row) => db.prepare(`
    INSERT OR IGNORE INTO cf_container_package_release_history (
      container_key, package_name, installed_version, installed_status,
      latest_version, latest_release_at, current_release_at,
      release_status, update_status, source, error,
      installed_snapshot_id, installed_snapshot_at, trigger_kind, checked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    row.containerKey, row.packageName, row.installedVersion, row.installedStatus,
    row.latestVersion, row.latestReleaseAt, row.currentReleaseAt,
    row.releaseStatus, row.updateStatus, row.source, row.error,
    row.installedSnapshotId, row.installedSnapshotAt, trigger, row.checkedAt,
  ));
  await db.batch([...upserts, ...history]);
}

export type PackageReleaseCheckResult = {
  containerKey: string;
  trigger: ReleaseCheckTrigger;
  checkedAt: string;
  packageCount: number;
  historyRecorded: number;
  updatesAvailable: number;
  latestUnavailable: number;
};

// 最新版と導入版を照合して、現在の状態と履歴に記録する。エンドポイントから切り出した本体(テストしやすくするため)。
export async function recordPackageReleaseCheck(
  db: D1Database,
  input: { containerKey: string; snapshot: SnapshotRecord | null; latest: LatestToolVersions; trigger: ReleaseCheckTrigger; checkedAt: string },
): Promise<PackageReleaseCheckResult> {
  const records = buildPackageReleaseStatuses(input.containerKey, input.snapshot, input.latest, input.checkedAt);
  await savePackageReleaseStatuses(db, records, input.trigger);
  return {
    containerKey: input.containerKey,
    trigger: input.trigger,
    checkedAt: input.checkedAt,
    packageCount: records.length,
    historyRecorded: records.length,
    updatesAvailable: records.filter((row) => row.updateStatus === 'update_available').length,
    latestUnavailable: records.filter((row) => row.releaseStatus === 'failed').length,
  };
}
