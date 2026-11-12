import { beforeEach, expect, it, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
const container = vi.hoisted(() => ({ getState: vi.fn(), fetch: vi.fn() }));
vi.mock('./containers/demoContainerStub', () => ({ getDemoContainer: () => container }));
const worker = { fetch: vi.fn() };
const ns = { idFromName: vi.fn(() => 'muse'), get: vi.fn(() => worker) };
const rust = { fetch: vi.fn() };
const DB = { prepare: (sql: string) => ({ first: async () => ({ revision: 1, timeoutSeconds: 120 }), all: async () => ({ results: [] }), bind: () => ({ first: async () => sql.includes('user_sessions') ? { revoked_at: null } : null, run: async () => ({ success: true }) }) }) };
beforeEach(() => {
  vi.clearAllMocks();
  container.getState.mockResolvedValue({ status: 'running' });
  container.fetch.mockImplementation(async (r: Request) => new URL(r.url).pathname.includes('peers') ? Response.json({ backendState: 'Running', peers: [{ hostName: 'muse-vm', online: true }] }) : Response.json({ model: 'muse', choices: [{ message: { content: 'container answer' } }] }));
  worker.fetch.mockImplementation(async (r: Request) => new URL(r.url).pathname.endsWith('/health') ? Response.json({ status: 'ok' }) : Response.json({ model: 'muse', choices: [{ message: { content: 'worker answer' } }] }));
});
async function request(body?: Record<string, unknown>, cookie = '', namespace: unknown = ns) {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, 'transport-test');
  return app.request(body ? '/api/aichat' : '/api/aichat/muse-health', { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Cookie: cookie }, ...(body ? { body: JSON.stringify(body) } : {}) }, { JWT_SECRET: 'transport-test', DB, DEMO_CONTAINER: {}, TAILSCALE_WASM: namespace, MUSE_API_KEY: 'test-key', RUST_WORKER: rust });
}
const message = { model: 'muse', message: '通常の質問 “△”', source: 'textbox' };
// 接頭語なしの Muse は直通(本体のコンテナから muse-vm へ)が既定(ユーザー指定 2026-11-12)。Worker内WASMは明示的に選んだときだけ。
const workerCookie = 'aichat_muse_signal=' + encodeURIComponent(JSON.stringify({ transport: 'worker', enabled: true, intervalSeconds: 600 }));
it('defaults prefixless Muse to direct (container), preserving prompt and sending exactly once without touching the Worker', async () => {
  const response = await request(message);
  expect(await response.json()).toMatchObject({ usedModel: 'muse', response: expect.stringContaining('container answer') });
  expect(response.headers.get('X-Muse-Transport')).toBe('container');
  expect(response.headers.get('X-Muse-Tailscale')).toBe('connected');
  const sent = container.fetch.mock.calls.map(([r]) => r as Request).filter(r => new URL(r.url).pathname === '/muse/v1/chat/completions');
  expect(sent).toHaveLength(1);
  expect(sent[0].headers.get('Authorization')).toBe('Bearer test-key');
  expect(sent[0].headers.get('Content-Type')).toBe('application/json');
  expect(await sent[0].text()).toBe(JSON.stringify({ model: 'muse', messages: [{ role: 'user', content: message.message }] }));
  expect(worker.fetch).not.toHaveBeenCalled(); expect(rust.fetch).not.toHaveBeenCalled();
});
it('direct send failure reports unavailable in X-Muse-Tailscale even after a connected preflight', async () => {
  container.fetch.mockImplementation(async (r: Request) => new URL(r.url).pathname.includes('peers') ? Response.json({ backendState: 'Running', peers: [{ hostName: 'muse-vm', online: true }] }) : Response.json({ error: 'muse_connection_failed' }, { status: 502 }));
  const response = await request(message);
  expect((await response.json() as { response: string }).response).toContain('❌');
  expect(response.headers.get('X-Muse-Tailscale')).toBe('unavailable');
  expect(worker.fetch).not.toHaveBeenCalled(); expect(rust.fetch).not.toHaveBeenCalled();
});
it('uses the saved Worker choice for both health and submission', async () => {
  expect((await (await request(message, workerCookie)).json() as { response: string }).response).toContain('worker answer');
  await request(undefined, workerCookie);
  expect(container.fetch).not.toHaveBeenCalled(); expect(worker.fetch).toHaveBeenCalled();
});
it('Worker health uses the same route without inference or container startup', async () => {
  expect(await (await request(undefined, workerCookie)).json()).toMatchObject({ healthy: true, transport: 'worker' });
  expect(new URL(worker.fetch.mock.calls[0][0].url).pathname).toBe('/muse/health');
  expect(container.getState).not.toHaveBeenCalled();
});
it('does not fall back when Worker is selected and missing or failing', async () => {
  worker.fetch.mockResolvedValue(Response.json({ error: 'tailscale_not_connected' }, { status: 503 }));
  const result = await (await request(message, workerCookie)).json() as { response: string };
  expect(result.response).toContain('❌');
  expect(container.fetch).not.toHaveBeenCalled(); expect(rust.fetch).not.toHaveBeenCalled();
  worker.fetch.mockClear();
  expect((await (await request(message, workerCookie, null)).json() as { response: string }).response).toContain('❌');
  expect(worker.fetch).not.toHaveBeenCalled(); expect(container.fetch).not.toHaveBeenCalled();
});
it('explicit /askmuse keeps its legacy route even when Worker is selected', async () => {
  expect((await (await request({ ...message, message: '/askmuse prompt="explicit"' }, workerCookie)).json() as { response: string }).response).toContain('container answer');
  expect(worker.fetch).not.toHaveBeenCalled();
});
