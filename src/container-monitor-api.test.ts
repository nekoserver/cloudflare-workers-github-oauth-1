import { describe, expect, it } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
const secret = 'container-monitor-test-secret';
const DB = { prepare: () => ({ bind: () => ({ first: async () => ({ revoked_at: null }) }) }) };
const env = { JWT_SECRET: secret, DB, CF_DASHBOARD_ADMIN_GITHUB_IDS: '85157166' };
describe('container monitoring API authorization', () => {
  it('requires login and administrator identity for the page and both APIs', async () => {
    const token = await createJWT({ sub: 'other', github_id: 2 }, secret);
    for (const path of ['/container-monitor', '/api/container-monitor/providers', '/api/container-monitor/snapshot']) {
      const unauthenticated = await app.request(path, {}, env);
      expect([302, 401]).toContain(unauthenticated.status);
      expect((await app.request(path, { headers: { Authorization: `Bearer ${token}` } }, env)).status).toBe(403);
    }
  });
  it('serves the no-token WASM option and browser policy for an administrator', async () => {
    const token = await createJWT({ sub: 'admin', github_id: 85157166 }, secret);
    const headers = { Authorization: `Bearer ${token}` };
    const page = await app.request('/container-monitor', { headers }, env);
    expect(page.status).toBe(200); expect(page.headers.get('Content-Security-Policy')).toContain("'wasm-unsafe-eval'");
    expect(await page.text()).toContain('/container-monitor.mjs');
    const config = await app.request('/api/container-monitor/providers', { headers }, env);
    expect(config.headers.get('Cache-Control')).toBe('no-store');
    expect((await config.json()).defaultProvider).toBe('tailscale-wasm');
    expect((await app.request('/api/container-monitor/snapshot?provider=cloudflare-api', { headers }, env)).status).toBe(400);
  });
});
describe('/muse-statusのブラウザ方針', () => {
  it('Tailscale WASMの読み込みと接続をCSPで許可し、それ以外の外部接続は許可しない', async () => {
    const token = await createJWT({ sub: 'admin', github_id: 85157166 }, secret);
    const page = await app.request('/muse-status', { headers: { Authorization: `Bearer ${token}` } }, env);
    expect(page.status).toBe(200);
    const csp = page.headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain("'wasm-unsafe-eval'");
    expect(csp).toContain('wss://*.tailscale.com');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/connect-src[^;]*\*(?!\.tailscale)/);
  });
});
