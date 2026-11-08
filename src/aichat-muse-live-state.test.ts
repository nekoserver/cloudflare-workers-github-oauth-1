import { beforeEach, expect, it, vi } from 'vitest';
const runtime = vi.hoisted(() => ({ running: true, stored: 'stopped', order: [] as string[], start: vi.fn(), stub: undefined as unknown }));
vi.mock('@cloudflare/containers', () => ({
  getContainer: () => runtime.stub,
  Container: class {
    ctx = { container: runtime };
    async getState() { runtime.order.push('state'); return { status: runtime.stored, lastChange: 1 }; }
    async start() { runtime.start(); }
    async fetch(request: Request) {
      const path = new URL(request.url).pathname;
      runtime.order.push(path);
      if (path === '/debug/tailscale-peers') return Response.json({ backendState: 'Running', peers: [{ hostName: 'muse-vm', online: true }] });
      if (path === '/muse/v1/chat/completions') {
        expect(await request.json()).toMatchObject({ messages: [{ role: 'user', content: '通常の質問 “△”' }] });
        return Response.json({ model: 'muse', choices: [{ message: { content: 'Museの回答' } }] });
      }
      throw new Error('Unexpected route: ' + path);
    }
  },
}));
import app from './index';
import { DemoContainer } from './containers/demoContainer';
import { createJWT } from './utils/jwt';
const RUST_WORKER = { fetch: vi.fn() };
const DB = { prepare: (sql: string) => ({
  first: async () => ({ revision: 1, timeoutSeconds: 120 }),
  all: async () => ({ results: [] }),
  bind: (..._args: unknown[]) => ({ first: async () => sql.includes('user_sessions') ? { revoked_at: null } : null, run: async () => ({ success: true }) }),
}) };
beforeEach(() => {
  runtime.running = true; runtime.stored = 'stopped'; runtime.order = []; runtime.start.mockClear(); RUST_WORKER.fetch.mockClear();
  runtime.stub = new DemoContainer({} as never, {} as never);
});
async function post() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, 'live-state-test');
  return app.request('/api/aichat', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Cookie: 'aichat_muse_signal=%7B%22transport%22%3A%22container%22%7D' }, body: JSON.stringify({ model: 'muse', message: '通常の質問 “△”', source: 'textbox' }) }, { JWT_SECRET: 'live-state-test', DB, DEMO_CONTAINER: {}, MUSE_API_KEY: 'test-key', RUST_WORKER });
}
it('Muse textbox checks live state, tailnet, live state again, then sends original text directly exactly once', async () => {
  const response = await post();
  expect(await response.json()).toMatchObject({ usedModel: 'muse', response: expect.stringContaining('Museの回答') });
  expect(runtime.order).toEqual(['state', '/debug/tailscale-peers', 'state', '/muse/v1/chat/completions']);
  expect(RUST_WORKER.fetch).not.toHaveBeenCalled(); expect(runtime.start).not.toHaveBeenCalled();
});
it('a stopped runtime blocks before tailnet/inference even with a stale healthy record', async () => {
  runtime.running = false; runtime.stored = 'healthy';
  expect((await (await post()).json() as { response: string }).response).toContain('停止中');
  expect(runtime.order).toEqual(['state']); expect(RUST_WORKER.fetch).not.toHaveBeenCalled(); expect(runtime.start).not.toHaveBeenCalled();
});
