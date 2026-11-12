import { beforeEach, expect, it, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
const container = vi.hoisted(() => ({ getState: vi.fn(), fetch: vi.fn() }));
vi.mock('./containers/demoContainerStub', () => ({ getDemoContainer: () => container }));
const taskStub = { fetch: vi.fn(async () => Response.json({ status: 'pending' }, { status: 202 })) };
const AICHAT_JOB = { idFromName: vi.fn((id: string) => id), get: vi.fn(() => taskStub) };
const secret = 'tailscale-durable-task-test';
beforeEach(() => { vi.clearAllMocks(); taskStub.fetch.mockResolvedValue(Response.json({ status: 'pending' }, { status: 202 })); });
async function submit(body: unknown, cookie = 'aichat_muse_signal=%7B%22transport%22%3A%22worker%22%7D') {
  const token = await createJWT({ sub: 'admin', github_id: 85157166 }, secret);
  return app.request('http://worker.test/api/tailscale-wasm/tasks', { method: 'POST', headers: { Authorization: 'Bearer ' + token, Origin: 'http://worker.test', Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, { JWT_SECRET: secret, CF_DASHBOARD_ADMIN_GITHUB_IDS: '85157166', AICHAT_JOB });
}
it.each([
  ['bridge-chat', '/api/tailscale-wasm/bridge-chat'],
  ['agent-ask', '/api/tailscale-wasm/agent-ask'],
])('queues %s through the shared Durable Object without changing its body', async (action, endpoint) => {
  const payload = action === 'bridge-chat' ? { prompt: 'Muse question' } : { engine: 'codex', prompt: 'Review this', review: true };
  const response = await submit({ action, payload });
  expect(response.status).toBe(202);
  expect(await response.json()).toMatchObject({ jobId: expect.any(String) });
  const call = taskStub.fetch.mock.calls[0];
  const start = JSON.parse(String((call[1] as RequestInit).body)) as { owner: string; request: { url: string; body: string; headers: Record<string, string> } };
  expect(start.owner).toBe('admin'); expect(new URL(start.request.url).pathname).toBe(endpoint);
  expect(JSON.parse(start.request.body)).toEqual(payload);
  expect(start.request.headers.authorization).toMatch(/^Bearer /);
});
// AIチャットからのMuse送信は常に直送なので、経路をCookieで上書きする必要は無い(ユーザー指定 2026-11-12)。
it('keeps an explicit legacy Muse fallback as its own job without rewriting cookies', async () => {
  const response = await submit({ action: 'legacy-chat', payload: { model: 'muse', message: 'explicit old-route request' } });
  expect(response.status).toBe(202);
  const start = JSON.parse(String((taskStub.fetch.mock.calls[0][1] as RequestInit).body)) as { request: { url: string; body: string; headers: Record<string, string> } };
  expect(new URL(start.request.url).pathname).toBe('/api/aichat');
  expect(JSON.parse(start.request.body)).toMatchObject({ model: 'muse', message: 'explicit old-route request', source: 'textbox', stream: false });
  expect(start.request.headers.cookie).toBe('aichat_muse_signal=%7B%22transport%22%3A%22worker%22%7D');
  expect((await submit({ action: 'legacy-chat', payload: { model: 'codex', message: 'wrong model' } })).status).toBe(400);
  expect((await submit({ action: 'legacy-chat', payload: { model: 'muse', message: '/askmuse prompt="do not route this"' } })).status).toBe(400);
});
