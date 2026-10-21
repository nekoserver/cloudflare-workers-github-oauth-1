import { expect, it } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

it('AIチャットだけが会話ストリームの埋め込み先を読み込めるCSPを返す', async () => {
  const secret = 'aichat-stream-csp-test-secret';
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, secret);
  const response = await app.request('/aichat', {
    headers: { Authorization: `Bearer ${token}` },
  }, { JWT_SECRET: secret });

  expect(response.status).toBe(200);
  const csp = response.headers.get('Content-Security-Policy') ?? '';
  expect(csp).not.toContain('mygw.nekomaneki.work');
  expect(csp).not.toContain('mynw.nekomaneki.work');
  expect(csp).toContain('frame-src https://stream.test.cfc.nekomaneki.work');
});
