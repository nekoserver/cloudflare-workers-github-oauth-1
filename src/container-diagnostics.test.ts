import { beforeEach, expect, it, vi } from 'vitest';
import { createJWT } from './utils/jwt';
const stub = { getState: vi.fn(), fetch: vi.fn() };
vi.mock('@cloudflare/containers', () => ({ getContainer: () => stub }));
import app from './index';
const secret = 'diagnostics-test-secret';
const env = { JWT_SECRET: secret, CF_DASHBOARD_ADMIN_GITHUB_IDS: '42', DEMO_CONTAINER: {} };
async function headers(admin = true) {
  return { Authorization: 'Bearer ' + await createJWT({ sub: 'admin', github_id: admin ? 42 : 1 }, secret) };
}
beforeEach(() => { vi.clearAllMocks(); });
it('protects the page, live statistics and history against unauthenticated/non-admin reads', async () => {
  for (const path of ['/cf-containers/diagnostics', '/api/cf-containers/diagnostics', '/api/cf-containers/firewall/history', '/api/cf-containers/firewall/history/1']) {
    expect((await app.request(path, {}, env)).status).toBe(401);
    expect((await app.request(path, { headers: await headers(false) }, env)).status).toBe(403);
  }
  expect(stub.fetch).not.toHaveBeenCalled();
});
it('serves the diagnostics page to administrators without starting or fetching the container', async () => {
  const r = await app.request('/cf-containers/diagnostics', { headers: await headers() }, env);
  expect(r.status).toBe(200);
  expect(await r.text()).toContain('保存履歴');
  expect(r.headers.get('Cache-Control')).toContain('no-store');
  expect(stub.fetch).not.toHaveBeenCalled();
});
it('does not fetch a stopped container', async () => {
  stub.getState.mockResolvedValue({ status: 'stopped' });
  const r = await app.request('/api/cf-containers/diagnostics', { headers: await headers() }, env);
  expect((await r.json()).running).toBe(false);
  expect(stub.fetch).not.toHaveBeenCalled();
});
it('returns health independently of an unavailable firewall endpoint', async () => {
  stub.getState.mockResolvedValue({ status: 'running' });
  stub.fetch.mockImplementation(async (req: Request) => req.url.endsWith('/health')
    ? Response.json({ apache: true, sshd: true, cloudflared: false }) : Response.json({ message: 'old image' }));
  const r = await app.request('/api/cf-containers/diagnostics', { headers: await headers() }, env);
  const data = await r.json();
  expect(data.health.apache).toBe(true);
  expect(data.health.cloudflared).toBe(false);
  expect(data.firewall.available).toBe(false);
});
it('validates date ranges and IDs before database access', async () => {
  const h = await headers();
  for (const path of ['/api/cf-containers/firewall/history?from=bad', '/api/cf-containers/firewall/history?limit=99999', '/api/cf-containers/firewall/history/NaN']) {
    expect((await app.request(path, { headers: h }, env)).status).toBe(400);
  }
});
it('returns summaries with pagination and retrieves IPv6/CIDR snapshot details', async () => {
  const snapshot = { available: true, prefixTotals: [{ cidr: '2001:db8::/64', packets: 9 }] };
  const bind = vi.fn().mockReturnValue({ all: vi.fn().mockResolvedValue({ results: [{ id: 4, packets: 9, available: 1 }] }), first: vi.fn().mockResolvedValue({ id: 4, collected_at: '2026-10-21T12:05:00Z', snapshot_json: JSON.stringify(snapshot) }) });
  const DB = { prepare: vi.fn().mockReturnValue({ bind }) };
  const r = await app.request('/api/cf-containers/firewall/history?limit=1', { headers: await headers() }, { ...env, DB });
  expect(await r.json()).toEqual({ rows: [{ id: 4, packets: 9, available: 1 }], nextBefore: 4 });
  const detail = await app.request('/api/cf-containers/firewall/history/4', { headers: await headers() }, { ...env, DB });
  expect((await detail.json()).snapshot.prefixTotals[0].cidr).toBe('2001:db8::/64');
  expect(bind).toHaveBeenLastCalledWith('nekoroot', 4);
});
