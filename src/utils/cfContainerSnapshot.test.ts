import { describe, it, expect } from 'vitest';
import { computeSnapshotDiffs, buildVersionReport, buildCronHeader, type SnapshotValues } from './cfContainerSnapshot';

const base: SnapshotValues = {
  runningContainers: 0,
  connectedSeconds: 3600, estimatedCostUsd: 0.06, imageCommit: 'a'.repeat(40),
  versions: { node: '26.12.0', codex: null, tailscale: '1.104.1' },
};

describe('computeSnapshotDiffs', () => {
  it('前回が無ければ差分なし', () => {
    expect(computeSnapshotDiffs(null, base)).toEqual([]);
  });
  it('数値は増分、コミットと版は変わったものだけを差分にする', () => {
    const cur: SnapshotValues = { ...base, runningContainers: 1, connectedSeconds: 7200, estimatedCostUsd: 0.12, imageCommit: 'b'.repeat(40),
      versions: { node: '26.12.1', codex: null, tailscale: '1.104.1', jj: '0.46.0' } };
    const diffs = computeSnapshotDiffs(base, cur);
    expect(diffs).toContainEqual({ metric: 'running_containers', before: '0', after: '1', delta: 1 });
    expect(diffs).toContainEqual({ metric: 'connected_seconds', before: '3600', after: '7200', delta: 3600 });
    expect(diffs.find((d) => d.metric === 'estimated_cost_usd')?.delta).toBeCloseTo(0.06);
    expect(diffs).toContainEqual({ metric: 'image_commit', before: 'a'.repeat(40), after: 'b'.repeat(40), delta: null });
    expect(diffs).toContainEqual({ metric: 'version:node', before: '26.12.0', after: '26.12.1', delta: null });
    expect(diffs).toContainEqual({ metric: 'version:jj', before: null, after: '0.46.0', delta: null });
    expect(diffs.some((d) => d.metric === 'version:tailscale')).toBe(false);
    expect(diffs.some((d) => d.metric === 'version:codex')).toBe(false);
  });
});

describe('buildVersionReport', () => {
  it('最後に記録された版と配布元の最新を並べ、新版・取得失敗・記録なしを明示する', () => {
    const text = buildVersionReport(
      { createdAt: '2026-10-21T19:00:00Z', versions: { node: '26.12.0', codex: '0.163.0', gh: '2.103.0' } },
      {
        node: { latest: '26.12.1', source: 'nodejs.org' },
        codex: { latest: '0.163.0', source: 'npm' },
        gh: { latest: null, source: 'GitHub', error: 'HTTP 403' },
        jj: { latest: '0.47.0', source: 'crates.io' },
      }
    );
    expect(text).toContain('新版あり: 1件');
    expect(text).toContain('node: 26.12.0 → 新版 26.12.1');
    expect(text).toContain('codex: 0.163.0(最新)');
    expect(text).toContain('gh: 2.103.0(最新の取得に失敗: HTTP 403)');
    expect(text).toContain('jj: 記録なし(最新 0.47.0)');
  });
  it('記録が1件も無ければその旨を書く', () => {
    expect(buildVersionReport(null, {})).toContain('コンテナの版の記録がまだありません');
  });
});

describe('buildCronHeader', () => {
  it('稼働数と前回cronからの増分を書く', () => {
    const text = buildCronHeader(
      { runningContainers: 1, connectedSeconds: 7200, estimatedCostUsd: 0.12, imageCommit: null, versions: {} },
      [{ metric: 'connected_seconds', before: '3600', after: '7200', delta: 3600 }, { metric: 'estimated_cost_usd', before: '0.06', after: '0.12', delta: 0.06 }]
    );
    expect(text).toContain('稼働中のコンテナ: 1');
    expect(text).toContain('前回cronから +3600秒');
    expect(text).toContain('前回cronから +$0.0600');
  });
});
