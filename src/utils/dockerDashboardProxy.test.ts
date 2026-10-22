import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { cfDashboardAdminMiddleware } from '../middleware/auth';
import { proxyDockerDashboard } from './dockerDashboardProxy';
import { readFileSync } from 'node:fs';

const workerOrigin = 'https://worker.example';
function setup(githubId = 42) {
  const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
  app.use('*', async (c, next) => {
    c.set('user', { sub: 'admin', github_id: githubId } as Variables['user']);
    await next();
  });
  app.all('*', cfDashboardAdminMiddleware, proxyDockerDashboard);
  const signer = { fetch: vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ ok: true, status: 200, body: JSON.stringify({ output: 'Docker 29', exit_code: 0 }) })) };
  const env = { CF_DASHBOARD_ADMIN_GITHUB_IDS: '42', RUST_WORKER: signer } as unknown as Bindings;
  return { app, signer, env, request: (path: string, init?: RequestInit) => app.request(workerOrigin + path, init, env) };
}
beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => vi.unstubAllGlobals());
describe('Docker dashboard Worker gateway', () => {
  it('serves a same-origin page that uses Worker authentication without a secret', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('<html><head><title>Docker</title></head></html>'));
    const { request, signer } = setup();
    const response = await request('/cf-containers/docker.html');
    expect(await response.text()).toContain('<meta name="docker-auth-mode" content="worker">');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(signer.fetch).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith('https://mygw.nekomaneki.work/lib/docker.html', expect.objectContaining({ redirect: 'manual' }));
  });
  it.each(['css', 'mjs'])('serves the fixed %s asset', async (ext) => {
    vi.mocked(fetch).mockResolvedValue(new Response('asset'));
    const { request } = setup();
    expect((await request('/cf-containers/docker-dashboard.' + ext)).status).toBe(200);
  });
  it('denies non-admins before fetching assets or executing commands', async () => {
    const { request, signer } = setup(99);
    expect((await request('/cf-containers/docker.html')).status).toBe(403);
    expect((await request('/cf-containers/api/docker/run', { method: 'POST', headers: { Origin: workerOrigin }, body: '{"command":"version"}' })).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled(); expect(signer.fetch).not.toHaveBeenCalled();
  });
  it('does not give a browser a signer or origin cookie', async () => {
    const { request, signer } = setup();
    const res = await request('/cf-containers/api/docker/session');
    expect(await res.json()).toEqual({ authenticated: true, auth_mode: 'worker' });
    expect(res.headers.get('Set-Cookie')).toBeNull(); expect(signer.fetch).not.toHaveBeenCalled();
  });
  it('forwards catalog as a signed POST using only the fixed target', async () => {
    const { request, signer } = setup();
    expect((await request('/cf-containers/api/docker/catalog')).status).toBe(200);
    const body = JSON.parse(String(signer.fetch.mock.calls[0][1]?.body));
    expect(body).toEqual({ url: 'https://mygw.nekomaneki.work/lib/api/docker/worker/catalog', contentType: 'application/json', body: '{}' });
  });
  it('forwards only command and target, stripping user URLs and secrets', async () => {
    const { request, signer } = setup();
    const response = await request('/cf-containers/api/docker/run', { method: 'POST', headers: { Origin: workerOrigin }, body: JSON.stringify({ command: 'container_logs', target: 'abc123', url: 'https://evil.example', secret: 'do-not-forward' }) });
    expect(response.status).toBe(200);
    const outer = JSON.parse(String(signer.fetch.mock.calls[0][1]?.body));
    expect(outer.url).toBe('https://mygw.nekomaneki.work/lib/api/docker/worker/run');
    expect(JSON.parse(outer.body)).toEqual({ command: 'container_logs', target: 'abc123' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it.each([undefined, 'https://evil.example'])('rejects mutations with invalid Origin %s', async (origin) => {
    const { request, signer } = setup();
    expect((await request('/cf-containers/api/docker/run', { method: 'POST', headers: origin ? { Origin: origin } : {}, body: '{"command":"version"}' })).status).toBe(403);
    expect(signer.fetch).not.toHaveBeenCalled();
  });
  it.each(['session', 'run', 'catalog'])('rejects unrecognized method for %s', async (action) => {
    const { request, signer } = setup();
    const r = await request('/cf-containers/api/docker/' + action, { method: 'DELETE', headers: { Origin: workerOrigin } });
    expect(r.status).toBe(404);expect(signer.fetch).not.toHaveBeenCalled();
  });
  it.each(['{"command":[]}', '{"command":"docker rm"}', '{"command":"version","target":"--help"}', '[]', 'not json'])('rejects invalid payload %s', async (body) => {
    const { request, signer } = setup();
    expect((await request('/cf-containers/api/docker/run', { method: 'POST', headers: { Origin: workerOrigin }, body })).status).toBe(400);
    expect(signer.fetch).not.toHaveBeenCalled();
  });
  it('bounds request size before calling signer', async () => {
    const { request, signer } = setup();
    expect((await request('/cf-containers/api/docker/run', { method: 'POST', headers: { Origin: workerOrigin }, body: 'x'.repeat(4097) })).status).toBe(413);
    expect(signer.fetch).not.toHaveBeenCalled();
  });
  it('rejects query-provided destinations', async () => {
    const { request, signer } = setup();
    expect((await request('/cf-containers/api/docker/catalog?url=https://evil.example')).status).toBe(400);
    expect(signer.fetch).not.toHaveBeenCalled();
  });
  it('reports missing signer binding', async () => {
    const { app, env } = setup();
    const r = await app.request(workerOrigin + '/cf-containers/api/docker/session', {}, { ...env, RUST_WORKER: undefined });
    expect(r.status).toBe(503);
  });
  it('does not expose signer errors', async () => {
    const { request, signer } = setup();
    signer.fetch.mockResolvedValue(Response.json({ error: 'upstream contained secret detail' }));
    const r = await request('/cf-containers/api/docker/catalog');
    expect(r.status).toBe(502);expect(await r.text()).not.toContain('secret detail');
  });
  it('rejects asset redirects', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 302, headers: { Location: 'https://evil.example' } }));
    const { request } = setup();expect((await request('/cf-containers/docker.html')).status).toBe(502);
  });
  it('registers every gateway route behind authentication and admin middleware', () => {
    const source = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
    for (const route of ['/cf-containers/docker.html', '/cf-containers/docker-dashboard.css', '/cf-containers/docker-dashboard.mjs', '/cf-containers/api/docker/*']) {
      expect(source).toContain(`'${route}', authMiddleware, cfDashboardAdminMiddleware, proxyDockerDashboard`);
    }
  });
});
