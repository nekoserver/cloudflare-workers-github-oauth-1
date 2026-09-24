import { describe, expect, it } from 'vitest';
import { CookieJar, JSDOM } from 'jsdom';
import { getCronStatusPage, getNextTreeViewCronAt, getCronHealthStatus, pickLatestScheduledBatch } from './cronStatus';

const interactivePageInput = {
  generatedAt: '2026-09-22T07:00:00.000Z',
  dataAvailable: true,
  executions: [],
  snapshots: [
    { repo_name: 'nekoserver/first', updated_at: '2026-09-22T00:00:01.000Z' },
    { repo_name: 'nekoserver/second', updated_at: '2026-09-22T00:00:02.000Z' },
    { repo_name: 'nekoserver/third', updated_at: '2026-09-22T00:00:03.000Z' },
  ],
};

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
        { id: 2, repo_name: 'nekoserver/dynamicneko', update_source: 'scheduled', changed: 0, executed_at: '2026-09-22T06:00:05.000Z', error_message: null },
        { id: 1, repo_name: 'nekoserver/example', update_source: 'manual', changed: 1, executed_at: '2026-09-22T06:30:00.000Z', error_message: null },
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
      executions: [{ id: 1, repo_name: 'nekoserver/dynamicneko', update_source: 'scheduled', changed: 1, executed_at: '2026-09-22T06:00:00.000Z', error_message: null }],
    });
    expect(html).toContain('実行遅延');
  });

  it('shows a warning when the latest scheduled batch includes a failure', () => {
    const html = getCronStatusPage({
      generatedAt: '2026-09-22T07:00:00.000Z',
      dataAvailable: true,
      snapshots: [],
      executions: [
        { id: 2, repo_name: 'nekoserver/dynamicneko', update_source: 'scheduled', changed: 0, executed_at: '2026-09-22T06:00:00.000Z', error_message: null },
        { id: 1, repo_name: 'nekoserver/example', update_source: 'scheduled', changed: 0, executed_at: '2026-09-22T06:00:00.000Z', error_message: 'GitHub API 502' },
      ],
    });
    expect(html).toContain('一部失敗');
    expect(html).toContain('❌ 失敗');
    expect(html).toContain('GitHub API 502');
  });

  it('escapes values read from D1', () => {
    const html = getCronStatusPage({
      generatedAt: '2026-09-22T07:00:00.000Z', dataAvailable: true, executions: [],
      snapshots: [{ repo_name: '<script>alert(1)</script>', updated_at: 'invalid<time>' }],
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('shows row checkboxes with the check-mark control and sorts unchecked rows first', () => {
    const dom = new JSDOM(getCronStatusPage(interactivePageInput), {
      runScripts: 'dangerously',
      url: 'https://example.com/cron-status',
    });
    const { document } = dom.window;
    const table = document.querySelector<HTMLTableElement>('#snapshot-table')!;
    const toggle = document.querySelector<HTMLButtonElement>('#snapshot-toggle')!;
    const checkboxes = Array.from(document.querySelectorAll<HTMLInputElement>('.snapshot-checkbox'));

    expect(toggle.textContent).toContain('✔');
    expect(table.classList.contains('is-selecting')).toBe(false);
    toggle.click();
    expect(table.classList.contains('is-selecting')).toBe(true);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    checkboxes[2].click();
    checkboxes[1].click();
    expect(Array.from(table.tBodies[0].rows).map((row) => row.dataset.snapshotRepo))
      .toEqual(['nekoserver/first', 'nekoserver/second', 'nekoserver/third']);
    expect(checkboxes[1].closest('tr')!.classList.contains('is-checked')).toBe(true);

    toggle.click();
    expect(table.classList.contains('is-selecting')).toBe(false);
    expect(dom.window.getComputedStyle(checkboxes[1].closest('tr')!).display).toBe('none');
    expect(dom.window.getComputedStyle(checkboxes[0].closest('tr')!).display).not.toBe('none');
    dom.window.close();
  });

  it('restores checkbox and control state from the cookie on the next page load', () => {
    const cookieJar = new CookieJar();
    const options = { runScripts: 'dangerously' as const, url: 'https://example.com/cron-status', cookieJar };
    const firstLoad = new JSDOM(getCronStatusPage(interactivePageInput), options);
    firstLoad.window.document.querySelector<HTMLButtonElement>('#snapshot-toggle')!.click();
    firstLoad.window.document.querySelectorAll<HTMLInputElement>('.snapshot-checkbox')[2].click();
    firstLoad.window.close();

    const secondLoad = new JSDOM(getCronStatusPage(interactivePageInput), options);
    const { document } = secondLoad.window;
    expect(document.querySelector('#snapshot-table')!.classList.contains('is-selecting')).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('#snapshot-toggle')!.getAttribute('aria-pressed')).toBe('true');
    expect(Array.from(document.querySelectorAll<HTMLTableRowElement>('tbody tr')).map((row) => ({
      repo: row.dataset.snapshotRepo,
      checked: row.querySelector<HTMLInputElement>('.snapshot-checkbox')!.checked,
    }))).toEqual([
      { repo: 'nekoserver/first', checked: false },
      { repo: 'nekoserver/second', checked: false },
      { repo: 'nekoserver/third', checked: true },
    ]);
    expect(document.querySelector('tbody tr')!.getAttribute('data-snapshot-repo')).toBe('nekoserver/first');
    expect(cookieJar.getCookieStringSync('https://example.com/cron-status')).toContain('cron_snapshot_check_state=');
    secondLoad.window.close();
  });
});

describe('pickLatestScheduledBatch', () => {
  it('groups rows sharing the same executed_at into one batch and ignores manual rows', () => {
    const batch = pickLatestScheduledBatch([
      { id: 3, repo_name: 'nekoserver/a', update_source: 'manual', changed: 1, executed_at: '2026-09-22T07:00:00.000Z', error_message: null },
      { id: 2, repo_name: 'nekoserver/b', update_source: 'scheduled', changed: 0, executed_at: '2026-09-22T06:00:00.000Z', error_message: null },
      { id: 1, repo_name: 'nekoserver/c', update_source: 'scheduled', changed: 1, executed_at: '2026-09-22T06:00:00.000Z', error_message: null },
    ]);
    expect(batch).toEqual({ executedAt: '2026-09-22T06:00:00.000Z', failed: false });
  });

  it('marks the batch as failed when any row in it has an error_message', () => {
    const batch = pickLatestScheduledBatch([
      { id: 2, repo_name: 'nekoserver/a', update_source: 'scheduled', changed: 0, executed_at: '2026-09-22T06:00:00.000Z', error_message: null },
      { id: 1, repo_name: 'nekoserver/b', update_source: 'scheduled', changed: 0, executed_at: '2026-09-22T06:00:00.000Z', error_message: 'timeout' },
    ]);
    expect(batch).toEqual({ executedAt: '2026-09-22T06:00:00.000Z', failed: true });
  });

  it('returns null when there is no scheduled row', () => {
    expect(pickLatestScheduledBatch([])).toBeNull();
    expect(pickLatestScheduledBatch([
      { id: 1, repo_name: 'nekoserver/a', update_source: 'manual', changed: 0, executed_at: '2026-09-22T06:00:00.000Z', error_message: null },
    ])).toBeNull();
  });
});

describe('getCronHealthStatus', () => {
  it('returns unknown when data is unavailable', () => {
    expect(getCronHealthStatus('2026-09-22T07:00:00.000Z', null, false))
      .toEqual({ state: 'unknown', label: '確認できません' });
  });

  it('returns 実行待ち when there is no scheduled batch yet', () => {
    expect(getCronHealthStatus('2026-09-22T07:00:00.000Z', null, true))
      .toEqual({ state: 'warning', label: '実行待ち' });
  });

  it('returns 実行遅延 when the latest batch is stale', () => {
    expect(getCronHealthStatus('2026-09-22T14:30:00.000Z', { executedAt: '2026-09-22T06:00:00.000Z', failed: false }, true))
      .toEqual({ state: 'warning', label: '実行遅延' });
  });

  it('returns 一部失敗 when the latest fresh batch includes a failure', () => {
    expect(getCronHealthStatus('2026-09-22T07:00:00.000Z', { executedAt: '2026-09-22T06:00:00.000Z', failed: true }, true))
      .toEqual({ state: 'warning', label: '一部失敗' });
  });

  it('returns 正常稼働 when the latest fresh batch has no failures', () => {
    expect(getCronHealthStatus('2026-09-22T07:00:00.000Z', { executedAt: '2026-09-22T06:00:00.000Z', failed: false }, true))
      .toEqual({ state: 'healthy', label: '正常稼働' });
  });
});
