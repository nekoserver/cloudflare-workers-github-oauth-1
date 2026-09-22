import { describe, expect, it } from 'vitest';
import { getCronStatusPage, getNextTreeViewCronAt } from './cronStatus';

describe('cron status page', () => {
  it('calculates the next six-hour UTC boundary', () => {
    expect(getNextTreeViewCronAt(new Date('2026-09-22T07:23:45.000Z')).toISOString())
      .toBe('2026-09-22T12:00:00.000Z');
    expect(getNextTreeViewCronAt(new Date('2026-09-22T18:00:00.000Z')).toISOString())
      .toBe('2026-09-23T00:00:00.000Z');
  });

  it('shows configured job content and a healthy recent scheduled run', () => {
    const html = getCronStatusPage({
      generatedAt: '2026-09-22T07:00:00.000Z',
      dataAvailable: true,
      executions: [
        { id: 2, repo_name: 'nekoserver/dynamicneko', update_source: 'scheduled', changed: 0, executed_at: '2026-09-22T06:00:05.000Z' },
        { id: 1, repo_name: 'nekoserver/example', update_source: 'manual', changed: 1, executed_at: '2026-09-22T06:30:00.000Z' },
      ],
      snapshots: [{ repo_name: 'nekoserver/dynamicneko', updated_at: '2026-09-22T00:00:05.000Z' }],
    });

    expect(html).toContain('正常稼働');
    expect(html).toContain('0 */6 * * *');
    expect(html).toContain('src/worker-entry.ts scheduled()');
    expect(html).toContain('2026-09-22 12:00:00 UTC');
    expect(html).toContain('nekoserver/dynamicneko');
    expect(html).toContain('変更なし');
    expect(html).toContain('手動');
  });

  it('shows a warning when the last scheduled execution is stale', () => {
    const html = getCronStatusPage({
      generatedAt: '2026-09-22T14:30:00.000Z', dataAvailable: true, snapshots: [],
      executions: [{ id: 1, repo_name: 'nekoserver/dynamicneko', update_source: 'scheduled', changed: 1, executed_at: '2026-09-22T06:00:00.000Z' }],
    });
    expect(html).toContain('実行遅延');
  });

  it('escapes values read from D1', () => {
    const html = getCronStatusPage({
      generatedAt: '2026-09-22T07:00:00.000Z', dataAvailable: true, executions: [],
      snapshots: [{ repo_name: '<script>alert(1)</script>', updated_at: 'invalid<time>' }],
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
