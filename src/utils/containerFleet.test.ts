import { describe, expect, it, vi } from 'vitest';
import { collectContainerFleet } from './containerFleet';
const credentials = { accountId: 'account', apiToken: 'private-token' };
const response = (rows: unknown[], next?: string) => new Response(JSON.stringify({ success: true, result: rows, result_info: { next_page_token: next } }));
describe('container fleet metadata', () => {
  it('discovers added applications and follows both pagination levels without waking containers', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input)); expect(init?.method).toBeUndefined(); expect(url.hostname).toBe('api.cloudflare.com');
      if (url.pathname.endsWith('/applications')) return url.searchParams.has('page_token') ? response([{ id: 'b', name: 'added' }]) : response([{ id: 'a', name: 'main', configuration: { secret: 'not-public' } }], 'apps-next');
      if (url.pathname.includes('/a/')) return url.searchParams.has('page_token') ? response([{ id: 'two', status: { state: 'stopped' } }]) : response([{ id: 'one', status: { state: 'running', updated_at: '2026-10-26T00:00:00Z' }, env: { secret: 'not-public' } }], 'instances-next');
      return response([]);
    });
    const fleet = await collectContainerFleet(credentials, fetcher);
    expect(fleet.complete).toBe(true); expect(fleet.applications).toHaveLength(2);
    expect(fleet.applications[0].instances.map(row => row.state)).toEqual(['running', 'stopped']);
    expect(JSON.stringify(fleet)).not.toContain('not-public'); expect(JSON.stringify(fleet)).not.toContain('private-token');
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
  it('keeps a failed instance list unknown and reports partial coverage', async () => {
    const fleet = await collectContainerFleet(credentials, async input => String(input).includes('instances-v2') ? new Response('', { status: 403 }) : response([{ id: 'a' }]));
    expect(fleet.complete).toBe(false); expect(fleet.applications[0]).toMatchObject({ complete: false, instances: [], error: 'Cloudflare API HTTP 403' });
  });
  it('rejects failure and malformed application lists instead of reporting all stopped', async () => {
    await expect(collectContainerFleet(credentials, async () => new Response(JSON.stringify({ success: false, result: [] })))).rejects.toThrow();
    await expect(collectContainerFleet(credentials, async () => new Response(JSON.stringify({ success: true, result: {} })))).rejects.toThrow();
  });
  it('detects repeated cursors', async () => {
    await expect(collectContainerFleet(credentials, async () => response([], 'same'))).rejects.toThrow('循環');
  });
});
