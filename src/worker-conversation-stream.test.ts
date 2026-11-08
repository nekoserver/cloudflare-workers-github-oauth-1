import { expect, it, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
it('requires login for Worker stream and supplies a same-origin live view without starting a container', async () => {
  expect((await app.request('/aichat/worker-stream')).status).not.toBe(200);
  const token = await createJWT({ sub: 'stream-user' }, 'worker-stream-test');
  const res = await app.request('/aichat/worker-stream', { headers: { Authorization: 'Bearer ' + token } }, { JWT_SECRET: 'worker-stream-test' });
  expect(res.status).toBe(200); expect(res.headers.get('Cache-Control')).toBe('no-store');
  expect(await res.text()).toContain('conversation-snapshot');
});
it('Worker heartbeat is cheap, authenticated, and does not probe other services', async () => {
  const upstream = vi.fn(); vi.stubGlobal('fetch', upstream);
  try {
    expect((await app.request('/api/aichat/conversation-stream/worker-health')).status).toBe(401);
    const token = await createJWT({ sub: 'stream-user' }, 'worker-stream-test');
    const res = await app.request('/api/aichat/conversation-stream/worker-health', { headers: { Authorization: 'Bearer ' + token } }, { JWT_SECRET: 'worker-stream-test' });
    expect(await res.json()).toEqual({ healthy: true, service: 'worker-conversation-stream' });
    expect(upstream).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
