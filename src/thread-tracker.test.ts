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

function makeFailingDb(message: string) {
  return {
    prepare(sql: string) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes('FROM user_sessions')) {
                return { last_activity_at: new Date().toISOString(), revoked_at: null, idle_timeout_seconds: null };
              }
              return null;
            },
            async all() { throw new Error(message); },
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
    expect(html).toContain('/api/aichat/threads/seed');
    expect(html).toContain('/api/aichat/threads/');
    expect(html).toContain('id="threadSearch"');
    expect(html).toContain("searchEl.addEventListener('input',renderThreads)");
    expect(html).toContain('&lt;alice&gt;');
    expect(html).not.toContain('<alice>');
  });
});

describe('GET /api/aichat/threads/seed', () => {
  it('期間制限なしの過去ログをスレッドごとのシードデータへ整形する', async () => {
    const rows = [
      { id: 'share-1', thread_id: THREAD_ID, question: '昔の質問', answer: '昔の回答', model: 'gemma', source: 'textbox', created_at: '2025-01-01T00:00:00.000Z' },
      { id: 'share-2', thread_id: THREAD_ID, question: '続き', answer: '続きの回答', model: 'gemma', source: 'textbox', created_at: '2025-01-02T00:00:00.000Z' },
    ];
    const res = await app.request('/api/aichat/threads/seed', { headers: { Cookie: await authCookie() } }, { JWT_SECRET: SECRET, DB: makeDb(rows) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ threads: [{
      threadId: THREAD_ID,
      latestActivityAt: '2025-01-02T00:00:00.000Z',
      turns: rows.map((row) => ({ id: row.id, question: row.question, answer: row.answer, model: row.model, source: row.source, createdAt: row.created_at })),
    }] });
  });

  it('期間条件を使わず、所有者と未削除行だけを取得する', async () => {
    let capturedSql = '';
    const db = { prepare(sql: string) { capturedSql = sql; return { bind() { return { async first() { return { last_activity_at: new Date().toISOString(), revoked_at: null, idle_timeout_seconds: null }; }, async all() { return { results: [] }; }, async run() { return { success: true }; } }; } }; } };
    await app.request('/api/aichat/threads/seed', { headers: { Cookie: await authCookie() } }, { JWT_SECRET: SECRET, DB: db });
    expect(capturedSql).toContain('user_id = ?');
    expect(capturedSql).toContain('thread_id IS NOT NULL');
    expect(capturedSql).toContain('deleted_at IS NULL');
    expect(capturedSql).not.toContain('created_at >=');
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

  it('DBエラーの詳細を汎用サーバーエラーで隠さない', async () => {
    const res = await app.request('/api/aichat/threads/' + THREAD_ID, { headers: { Cookie: await authCookie() } }, { JWT_SECRET: SECRET, DB: makeFailingDb('no such column: thread_id') });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'スレッドの取得に失敗しました: no such column: thread_id' });
  });
});

describe('GET /api/aichat/threads/growing', () => {
  it('DBエラーの詳細をページへ返す', async () => {
    const res = await app.request('/api/aichat/threads/growing?limit=50', { headers: { Cookie: await authCookie() } }, { JWT_SECRET: SECRET, DB: makeFailingDb('no such column: thread_id') });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: '成長中スレッドの取得に失敗しました: no such column: thread_id' });
  });
});
