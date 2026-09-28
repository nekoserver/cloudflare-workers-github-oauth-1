import { describe, expect, it } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { getThreadTrackerPage } from './views/threadTracker';

const SECRET = 'thread-tracker-test-secret';
const THREAD_ID = '0123456789abcdef0123456789abcdef';

function makeDb(rows: Array<Record<string, unknown>>) {
  return {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first() { return sql.includes('FROM user_sessions') ? { last_activity_at: new Date().toISOString(), revoked_at: null, idle_timeout_seconds: null } : null; },
            async all() { return { results: sql.includes('FROM ai_chat_shares') && args[0] === 'alice' ? rows : [] }; },
            async run() { return { success: true }; },
          };
        },
      };
    },
  };
}

async function authCookie(): Promise<string> {
  return 'auth_token=' + await createJWT({ sub: 'alice' }, SECRET, 60) + '; last_activity=' + Date.now();
}

describe('thread tracker page', () => {
  it('ツリーUIと追跡APIの呼び出しを含み、ユーザー名をescapeする', () => {
    const html = getThreadTrackerPage('<alice>');
    expect(html).toContain('スレッド追跡ツリー');
    expect(html).toContain('/api/aichat/threads/growing?limit=50');
    expect(html).toContain('/api/aichat/threads/');
    expect(html).toContain('&lt;alice&gt;');
    expect(html).not.toContain('<alice>');
  });
});

describe('GET /api/aichat/threads/:threadId', () => {
  it('本人のターンだけを時系列レスポンスへ整形する', async () => {
    const rows = [{ id: 'share-1', question: '最初の質問', answer: '回答', model: 'gemma', source: 'textbox', created_at: '2026-09-28T00:00:00.000Z' }];
    const res = await app.request('/api/aichat/threads/' + THREAD_ID, { headers: { Cookie: await authCookie() } }, { JWT_SECRET: SECRET, DB: makeDb(rows) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ threadId: THREAD_ID, turns: [{ id: 'share-1', question: '最初の質問', answer: '回答', model: 'gemma', source: 'textbox', createdAt: '2026-09-28T00:00:00.000Z' }] });
  });

  it('不正なthreadIdをDB照会前に拒否する', async () => {
    const res = await app.request('/api/aichat/threads/not-valid', { headers: { Cookie: await authCookie() } }, { JWT_SECRET: SECRET, DB: makeDb([]) });
    expect(res.status).toBe(400);
  });

  it('他ユーザーの行がなく空なら404を返す', async () => {
    const res = await app.request('/api/aichat/threads/' + THREAD_ID, { headers: { Cookie: await authCookie() } }, { JWT_SECRET: SECRET, DB: makeDb([]) });
    expect(res.status).toBe(404);
  });
});
