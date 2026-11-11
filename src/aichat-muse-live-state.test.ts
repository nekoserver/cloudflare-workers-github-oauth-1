import { beforeEach, expect, it, vi } from 'vitest';
const runtime = vi.hoisted(() => ({ running: true, order: [] as string[], stub: undefined as unknown }));
vi.mock('cloudflare:workers', () => ({
  DurableObject: class { ctx: unknown; env: unknown; constructor(ctx: unknown, env: unknown) { this.ctx = ctx; this.env = env; } },
}));
vi.mock('./containers/demoContainerStub', () => ({ getDemoContainer: () => runtime.stub }));
import app from './index';
import { DemoContainer } from './containers/demoContainer';
import { createJWT } from './utils/jwt';
import { createFakeCtx } from './containers/demoContainerFakeCtx';
let fake: ReturnType<typeof createFakeCtx>;
const RUST_WORKER = { fetch: vi.fn() };
const DB = { prepare: (sql: string) => ({
  first: async () => ({ revision: 1, timeoutSeconds: 120 }),
  all: async () => ({ results: [] }),
  bind: (..._args: unknown[]) => ({ first: async () => sql.includes('user_sessions') ? { revoked_at: null } : null, run: async () => ({ success: true }) }),
}) };
beforeEach(() => {
  runtime.order = []; RUST_WORKER.fetch.mockClear();
  makeStub(true);
});
function makeStub(running: boolean) {
  fake = createFakeCtx({ running, ready: running });
  fake.ctx.container.getTcpPort = () => ({ async fetch(input: string | Request, init?: RequestInit) {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (url.host === 'ping') return new Response('pong');
    const path = url.pathname;
    runtime.order.push(path);
    if (path === '/debug/tailscale-peers') return Response.json({ backendState: 'Running', peers: [{ hostName: 'muse-vm', online: true }] });
    if (path === '/muse/v1/chat/completions') {
      const body = init?.body ?? (input instanceof Request ? await input.text() : '');
      expect(JSON.parse(typeof body === 'string' ? body : await new Response(body as BodyInit).text())).toMatchObject({ messages: [{ role: 'user', content: '通常の質問 “△”' }] });
      return Response.json({ model: 'muse', choices: [{ message: { content: 'Museの回答' } }] });
    }
    throw new Error('Unexpected route: ' + path);
  } });
  const instance = new DemoContainer(fake.ctx as never, {} as never);
  const getState = instance.getState.bind(instance);
  instance.getState = async () => { runtime.order.push('state'); return getState(); };
  runtime.stub = instance;
}
async function post() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, 'live-state-test');
  return app.request('/api/aichat', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Cookie: 'aichat_muse_signal=%7B%22transport%22%3A%22container%22%7D' }, body: JSON.stringify({ model: 'muse', message: '通常の質問 “△”', source: 'textbox' }) }, { JWT_SECRET: 'live-state-test', DB, DEMO_CONTAINER: {}, MUSE_API_KEY: 'test-key', RUST_WORKER });
}
it('Muse textbox checks live state, tailnet, live state again, then sends original text directly exactly once', async () => {
  const response = await post();
  expect(await response.json()).toMatchObject({ usedModel: 'muse', response: expect.stringContaining('Museの回答') });
  expect(runtime.order).toEqual(['state', '/debug/tailscale-peers', 'state', '/muse/v1/chat/completions']);
  expect(RUST_WORKER.fetch).not.toHaveBeenCalled(); expect(fake.calls.start).toHaveLength(0);
});
it('a stopped runtime blocks before tailnet/inference', async () => {
  makeStub(false);
  expect((await (await post()).json() as { response: string }).response).toContain('停止中');
  expect(runtime.order).toEqual(['state']); expect(RUST_WORKER.fetch).not.toHaveBeenCalled(); expect(fake.calls.start).toHaveLength(0);
});
