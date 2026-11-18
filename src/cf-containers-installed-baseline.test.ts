import { describe, expect, it, vi } from 'vitest';
import {
  INSTALLED_BASELINE_FRESH_MS,
  resolveInstalledBaseline,
  versionsFromHealthPayload,
  type InstalledBaselineDeps,
} from './utils/cfContainerInstalledBaseline';
import type { SnapshotRecord } from './utils/cfContainerSnapshot';

const NOW = new Date('2026-11-18T09:00:00.000Z');

function snapshotAt(iso: string, versions: Record<string, string | null> = { node: '26.13.0' }): SnapshotRecord {
  return {
    id: 1,
    createdAt: iso,
    runningContainers: 1,
    connectedSeconds: null,
    estimatedCostUsd: null,
    imageCommit: null,
    versions,
  };
}

function deps(overrides: Partial<InstalledBaselineDeps>): InstalledBaselineDeps {
  return {
    getLatestSnapshot: async () => null,
    isContainerRunning: async () => false,
    fetchInstalledVersions: async () => ({}),
    recordSnapshot: async () => null,
    now: () => NOW,
    ...overrides,
  };
}

describe('versionsFromHealthPayload', () => {
  it('health の items を 名前→実測版 の記録へ変換する', () => {
    const payload = {
      versions: {
        items: [
          { name: 'node', actual: '26.13.0' },
          { name: 'apache', actual: '2.4.70' },
          { name: 'docker', actual: null },
        ],
      },
    };
    expect(versionsFromHealthPayload(payload)).toEqual({ node: '26.13.0', apache: '2.4.70', docker: null });
  });

  it('形の違う入力では空の記録を返す', () => {
    expect(versionsFromHealthPayload(null)).toEqual({});
    expect(versionsFromHealthPayload({})).toEqual({});
    expect(versionsFromHealthPayload({ versions: { items: 'x' } })).toEqual({});
    expect(versionsFromHealthPayload({ versions: { items: [{ actual: '1.0.0' }, { name: 3, actual: '2.0.0' }] } })).toEqual({});
  });
});

describe('resolveInstalledBaseline', () => {
  it('新しいスナップショットがあれば、コンテナへ問い合わせずにそれを使う', async () => {
    const fresh = snapshotAt(new Date(NOW.getTime() - INSTALLED_BASELINE_FRESH_MS + 1000).toISOString());
    const isContainerRunning = vi.fn(async () => true);
    const fetchInstalledVersions = vi.fn(async () => ({ node: '26.13.1' }));
    const result = await resolveInstalledBaseline(deps({
      getLatestSnapshot: async () => fresh,
      isContainerRunning,
      fetchInstalledVersions,
    }));
    expect(result.snapshot).toBe(fresh);
    expect(result.refreshed).toBe(false);
    expect(isContainerRunning).not.toHaveBeenCalled();
    expect(fetchInstalledVersions).not.toHaveBeenCalled();
  });

  it('古いスナップショットでも、コンテナが停止中なら起動せずに古いまま使う', async () => {
    const stale = snapshotAt('2026-11-11T21:31:38.343Z');
    const fetchInstalledVersions = vi.fn(async () => ({ node: '26.13.1' }));
    const result = await resolveInstalledBaseline(deps({
      getLatestSnapshot: async () => stale,
      isContainerRunning: async () => false,
      fetchInstalledVersions,
    }));
    expect(result.snapshot).toBe(stale);
    expect(result.refreshed).toBe(false);
    expect(fetchInstalledVersions).not.toHaveBeenCalled();
  });

  it('古いスナップショットでコンテナが稼働中なら、実測を取り直して記録し、新しい基準を返す', async () => {
    const stale = snapshotAt('2026-11-11T21:31:38.343Z');
    const recorded = snapshotAt(NOW.toISOString(), { node: '26.13.0', apache: '2.4.70' });
    const recordSnapshot = vi.fn(async () => recorded);
    const result = await resolveInstalledBaseline(deps({
      getLatestSnapshot: async () => stale,
      isContainerRunning: async () => true,
      fetchInstalledVersions: async () => ({ node: '26.13.0', apache: '2.4.70' }),
      recordSnapshot,
    }));
    expect(recordSnapshot).toHaveBeenCalledWith({ node: '26.13.0', apache: '2.4.70' });
    expect(result.snapshot).toBe(recorded);
    expect(result.refreshed).toBe(true);
  });

  it('スナップショットが無くても、稼働中なら取り直して基準を作る', async () => {
    const recorded = snapshotAt(NOW.toISOString(), { node: '26.13.0' });
    const result = await resolveInstalledBaseline(deps({
      getLatestSnapshot: async () => null,
      isContainerRunning: async () => true,
      fetchInstalledVersions: async () => ({ node: '26.13.0' }),
      recordSnapshot: async () => recorded,
    }));
    expect(result.snapshot).toBe(recorded);
    expect(result.refreshed).toBe(true);
  });

  it('スナップショットが無くコンテナも停止中なら、基準なしのまま返す', async () => {
    const result = await resolveInstalledBaseline(deps({
      getLatestSnapshot: async () => null,
      isContainerRunning: async () => false,
    }));
    expect(result.snapshot).toBeNull();
    expect(result.refreshed).toBe(false);
  });

  it('取り直しに失敗したら、古い基準のまま返し、失敗を残す', async () => {
    const stale = snapshotAt('2026-11-11T21:31:38.343Z');
    const result = await resolveInstalledBaseline(deps({
      getLatestSnapshot: async () => stale,
      isContainerRunning: async () => true,
      fetchInstalledVersions: async () => { throw new Error('health HTTP 502'); },
    }));
    expect(result.snapshot).toBe(stale);
    expect(result.refreshed).toBe(false);
    expect(result.refreshError).toContain('health HTTP 502');
  });

  it('取り直した版が空なら記録せず、古い基準のまま返す', async () => {
    const stale = snapshotAt('2026-11-11T21:31:38.343Z');
    const recordSnapshot = vi.fn(async () => null);
    const result = await resolveInstalledBaseline(deps({
      getLatestSnapshot: async () => stale,
      isContainerRunning: async () => true,
      fetchInstalledVersions: async () => ({}),
      recordSnapshot,
    }));
    expect(recordSnapshot).not.toHaveBeenCalled();
    expect(result.snapshot).toBe(stale);
    expect(result.refreshed).toBe(false);
  });
});
