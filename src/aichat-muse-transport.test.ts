import { beforeEach, expect, it, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
const container = vi.hoisted(() => ({ getState: vi.fn(), fetch: vi.fn() }));
vi.mock('@cloudflare/containers', () => ({ getContainer: () => container }));
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
it('defaults prefixless Muse to Worker, preserving prompt and sending exactly once without touching the container', async () => {
  const response = await request(message);
  expect(await response.json()).toMatchObject({ usedModel: 'muse', response: expect.stringContaining('worker answer') });
  expect(response.headers.get('X-Muse-Transport')).toBe('worker');
  expect(response.headers.get('X-Muse-Tailscale')).toBe('connected');
  expect(worker.fetch).toHaveBeenCalledOnce();
  expect(await worker.fetch.mock.calls[0][0].json()).toMatchObject({ messages: [{ role: 'user', content: message.message }] });
  expect(container.getState).not.toHaveBeenCalled(); expect(container.fetch).not.toHaveBeenCalled(); expect(rust.fetch).not.toHaveBeenCalled();
});
it('uses saved legacy choice for both health and submission', async () => {
  const cookie = 'aichat_muse_signal=' + encodeURIComponent(JSON.stringify({ transport: 'container', enabled: true, intervalSeconds: 600 }));
  expect((await (await request(message, cookie)).json() as { response: string }).response).toContain('container answer');
  await request(undefined, cookie);
  expect(worker.fetch).not.toHaveBeenCalled(); expect(container.fetch).toHaveBeenCalled();
});
it('Worker health uses the same route without inference or container startup', async () => {
  expect(await (await request()).json()).toMatchObject({ healthy: true, transport: 'worker' });
  expect(new URL(worker.fetch.mock.calls[0][0].url).pathname).toBe('/muse/health');
  expect(container.getState).not.toHaveBeenCalled();
});
it('does not fall back when Worker is missing or fails', async () => {
  expect((await (await request(message, '', undefined)).json() as { response: string }).response).toContain('worker answer');
  worker.fetch.mockResolvedValue(Response.json({ error: 'tailscale_not_connected' }, { status: 503 }));
  const result = await (await request(message)).json() as { response: string };
  expect(result.response).toContain('❌');
  expect(container.fetch).not.toHaveBeenCalled(); expect(rust.fetch).not.toHaveBeenCalled();
  worker.fetch.mockClear();
  expect((await (await request(message, '', null)).json() as { response: string }).response).toContain('❌');
  expect(worker.fetch).not.toHaveBeenCalled(); expect(container.fetch).not.toHaveBeenCalled();
});
it('explicit /askmuse keeps its legacy route regardless of Worker default', async () => {
  expect((await (await request({ ...message, message: '/askmuse prompt="explicit"' })).json() as { response: string }).response).toContain('container answer');
  expect(worker.fetch).not.toHaveBeenCalled();
});
