import { expect, it, vi } from 'vitest';
import { fetchWorkerMuseCost } from './workerMuseCost';
it('keeps account-wide DO totals separate from this Worker and measures the current UTC month', async () => {
  const fetcher = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ data: { viewer: { accounts: [{ worker: [{ dimensions: { date: '2026-11-08' }, sum: { requests: 2953, errors: 0 } }], objects: [{ dimensions: { date: '2026-11-08' }, sum: { duration: 7301, activeTime: 57038948838, cpuTime: 967012, rowsRead: 1184, rowsWritten: 120 } }], requests: [{ sum: { requests: 2203 } }] }] } }, errors: null }));
  const result = await fetchWorkerMuseCost('account', 'secret', fetcher as typeof fetch, new Date('2026-11-08T22:00:00Z'));
  expect(result).toMatchObject({ workerRequests: 2953, doRequests: 2203, doDurationGBSeconds: 7301, doScope: 'account', periodStart: '2026-11-01T00:00:00.000Z' });
  expect(JSON.stringify(result)).not.toContain('secret');
  const body = JSON.parse(String(fetcher.mock.calls[0][1].body)); expect(body.query).toContain('cloudflare-workers-github-oauth-1');
  expect(body.query).toContain('2026-11-01');
});
it('does not turn an analytics permission failure into zero usage', async () => {
  await expect(fetchWorkerMuseCost('a', 'k', (async () => Response.json({ errors: [{ message: 'denied' }] })) as typeof fetch)).rejects.toThrow();
});
