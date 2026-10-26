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

export async function savePackageReleaseStatuses(db: D1Database, records: PackageReleaseStatus[]): Promise<void> {
  if (!records.length) return;
  await db.batch(records.map((row) => db.prepare(`
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
  )));
}
