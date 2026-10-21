import { afterEach, expect, it, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

afterEach(() => vi.unstubAllGlobals());
it('未認証のアクセスは上流を呼ばず拒否する', async () => {
  const probe = vi.fn();
  vi.stubGlobal('fetch', probe);
  const response = await app.request('/api/aichat/conversation-stream/health');
  expect(response.status).toBe(401);
  expect(probe).not.toHaveBeenCalled();
});
it.each([200, 503])('認証済みの利用者へ利用可能な埋め込み先を返す（上流HTTP %i）', async (status) => {
  const html = '<html data-embed="conversation"><script type="module" src="/chat/app.mjs"></script></html>';
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(status === 200 ? html : null, { status, headers: { 'Content-Type': 'text/html' } }))));
  const secret = 'stream-health-test-secret';
  const token = await createJWT({ sub: 'testuser' }, secret, 60);
  const response = await app.request('/api/aichat/conversation-stream/health', {
    headers: { Authorization: `Bearer ${token}` },
  }, { JWT_SECRET: secret });
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual({ healthy: status === 200, availableHosts: status === 200 ? ['testcfc', 'mygw', 'mynw'] : [] });
});
