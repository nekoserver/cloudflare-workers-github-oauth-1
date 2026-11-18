import type { SnapshotRecord } from './cfContainerSnapshot';

/**
 * パッケージ新版状況の照合(package-release-status/check)で使う「今入っている版」の基準を決める。
 *
 * 従来は、基準が画面のヘルスチェックで記録されたスナップショットだけで、ヘルスチェックが
 * 押されない期間は基準が古いまま固定されていた(2026-11-11の記録が1週間残った)。
 * 本モジュールは、基準が古い(6時間cronの周期を超えた)場合に限り、コンテナが既に稼働中なら
 * 起動させずに実測を取り直して記録し、新しい基準を返す。コンテナが停止中なら起動はせず、
 * 古い基準のまま返す(ページ表示を契機にコンテナを起動しない、という従来の設計を守る)。
 */

/** この記録でスナップショットを残すための、利用者ではない記録者ID。 */
export const RELEASE_CHECK_SNAPSHOT_USER_ID = 'system:release-check';

/** 基準が新しいとみなす上限。6時間cronの周期に合わせる。 */
export const INSTALLED_BASELINE_FRESH_MS = 6 * 60 * 60 * 1000;

export type InstalledBaselineDeps = {
  getLatestSnapshot: () => Promise<SnapshotRecord | null>;
  isContainerRunning: () => Promise<boolean>;
  fetchInstalledVersions: () => Promise<Record<string, string | null>>;
  recordSnapshot: (versions: Record<string, string | null>) => Promise<SnapshotRecord | null>;
  now: () => Date;
};

export type InstalledBaseline = {
  snapshot: SnapshotRecord | null;
  refreshed: boolean;
  refreshError?: string;
};

/** コンテナの /health の応答({versions:{items:[{name, actual}]}})を、名前→実測版の記録へ変換する。 */
export function versionsFromHealthPayload(payload: unknown): Record<string, string | null> {
  const items = (payload as { versions?: { items?: unknown } } | null)?.versions?.items;
  if (!Array.isArray(items)) return {};
  const versions: Record<string, string | null> = {};
  for (const item of items) {
    const name = (item as { name?: unknown } | null)?.name;
    if (typeof name !== 'string' || !name) continue;
    const actual = (item as { actual?: unknown }).actual;
    versions[name] = typeof actual === 'string' && actual ? actual : null;
  }
  return versions;
}

export async function resolveInstalledBaseline(deps: InstalledBaselineDeps): Promise<InstalledBaseline> {
  const snapshot = await deps.getLatestSnapshot();
  if (snapshot) {
    const ageMs = deps.now().getTime() - Date.parse(snapshot.createdAt);
    if (Number.isFinite(ageMs) && ageMs < INSTALLED_BASELINE_FRESH_MS) {
      return { snapshot, refreshed: false };
    }
  }
  let running = false;
  try {
    running = await deps.isContainerRunning();
  } catch {
    running = false;
  }
  if (!running) return { snapshot, refreshed: false };
  try {
    const versions = await deps.fetchInstalledVersions();
    if (Object.keys(versions).length === 0) {
      return { snapshot, refreshed: false, refreshError: 'コンテナの /health から版が取れませんでした' };
    }
    const recorded = await deps.recordSnapshot(versions);
    if (!recorded) return { snapshot, refreshed: false, refreshError: '取り直した版を記録できませんでした' };
    return { snapshot: recorded, refreshed: true };
  } catch (err) {
    return { snapshot, refreshed: false, refreshError: err instanceof Error ? err.message : String(err) };
  }
}
