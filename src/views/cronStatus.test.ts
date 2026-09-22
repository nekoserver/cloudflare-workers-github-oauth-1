import { describe, expect, it } from 'vitest';
import { CookieJar, JSDOM } from 'jsdom';
import { getCronStatusPage, getNextTreeViewCronAt } from './cronStatus';

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

  it('shows row checkboxes with the check-mark control and sorts checked rows first', () => {
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
      .toEqual(['nekoserver/second', 'nekoserver/third', 'nekoserver/first']);
    expect(checkboxes[1].closest('tr')!.classList.contains('is-checked')).toBe(true);
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
      { repo: 'nekoserver/third', checked: true },
      { repo: 'nekoserver/first', checked: false },
      { repo: 'nekoserver/second', checked: false },
    ]);
    expect(document.querySelector('tbody tr')!.getAttribute('data-snapshot-repo')).toBe('nekoserver/third');
    expect(cookieJar.getCookieStringSync('https://example.com/cron-status')).toContain('cron_snapshot_check_state=');
    secondLoad.window.close();
  });
});
