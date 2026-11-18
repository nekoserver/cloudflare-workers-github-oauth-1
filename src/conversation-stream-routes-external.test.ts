import { expect, it } from 'vitest';
import app from './index';
import ledger from './data/conversation-stream-routes.json';

const env = { AICHAT_EXTERNAL_SECRET: 'routes-external-test-secret' };

it('呼び出し元のWorkerを認証できなければ台帳を返さない', async () => {
  for (const headers of [{}, { Authorization: 'Bearer wrong' }] as Record<string, string>[]) {
    const response = await app.request('/api/tree-view/conversation-stream-routes-external', { headers }, env);
    expect(response.status).toBe(401);
  }
  const unconfigured = await app.request('/api/tree-view/conversation-stream-routes-external', { headers: { Authorization: 'Bearer ' } }, {});
  expect(unconfigured.status).toBe(401);
});

it('台帳の有効な接続先と自動選択の順を返す（各URLは含めない）', async () => {
  const response = await app.request('/api/tree-view/conversation-stream-routes-external', {
    headers: { Authorization: `Bearer ${env.AICHAT_EXTERNAL_SECRET}` },
  }, env);
  expect(response.status).toBe(200);
  const body = await response.json() as { routes: { id: string; origin: string; label: string }[]; autoPriority: string[] };
  const enabled = ledger.routes.filter(route => (route as { enabled?: boolean }).enabled !== false);
  expect(body.routes).toEqual(enabled.map(route => ({ id: route.id, origin: route.origin, label: new URL(route.origin).host })));
  expect(body.autoPriority).toEqual(ledger.autoPriority);
});
