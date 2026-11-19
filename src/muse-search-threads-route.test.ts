// /muse-search の初期画面用のルート(2026-11-19、ユーザー指定)。
//   GET /api/muse-search/threads … スレッドのタイトルのリンクを、最終書き込みの新しい順に並べるための一覧(上流の順をそのまま返す)。
//   GET /api/muse-search/thread?threadId= … そのスレッドの最終書き込みを、段落に分けて返す。
// 仮説: 管理者だけ。上流の失敗は理由つきで返し、空の一覧・空の本文にしない。本文は10万文字で切る。
import { describe, expect, it, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { createD1, createMuseSearchKeysSqlite } from './utils/museSearchKeys.testdb';

const JWT_SECRET = 'muse-search-threads-test';
const ADMIN_ID = 85157166;

function setup() {
  const db = createD1(createMuseSearchKeysSqlite(), { intercept: (sql) => (sql.includes('user_sessions') ? { revoked_at: null } : undefined) });
  const fetcher = (respond: () => Promise<Response>) => ({ fetch: vi.fn(respond) });
  const request = async (path: string, env: Record<string, unknown> = {}, githubId: number | null = ADMIN_ID) => {
    const headers: Record<string, string> = {};
    if (githubId !== null) headers.Authorization = 'Bearer ' + await createJWT({ sub: 'admin-user', github_id: githubId }, JWT_SECRET);
    return app.request(path, { headers }, { JWT_SECRET, DB: db, CF_DASHBOARD_ADMIN_GITHUB_IDS: String(ADMIN_ID), DYNAMICNEKO_WORKER_HMAC_SECRET: 's', ...env } as never);
  };
  return { fetcher, request };
}
const threads = { threads: [{ threadId: 't2', title: '新しいスレッド', lastPostAt: 200 }, { threadId: 't1', title: '古いスレッド', lastPostAt: 100 }] };
const last = { threadId: 't1', chatId: 'c1', role: 'assistant', content: '一段落目\n二行目\n\n二段落目', createdAt: 100 };

describe('GET /api/muse-search/threads', () => {
  it('未ログインは 401、管理者でなければ 403', async () => {
    const { request } = setup();
    expect((await request('/api/muse-search/threads', {}, null)).status).toBe(401);
    expect((await request('/api/muse-search/threads', {}, 2)).status).toBe(403);
  });
  it('上流の順(最終書き込みの新しい順)のまま、タイトルと最終書き込みの時刻を返す。no-store', async () => {
    const { fetcher, request } = setup();
    const up = fetcher(async () => Response.json(threads));
    const res = await request('/api/muse-search/threads', { DYNAMICNEKO: up });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual(threads);
    expect((up.fetch.mock.calls[0] as unknown as [string])[0]).toBe('https://dynamicneko.internal/api/tree-view/muse-thread-list');
  });
  it('上流の失敗は、空の一覧にせず、理由つきで返す(401・503は 502、形式違いも 502、未設定は 503)', async () => {
    const { fetcher, request } = setup();
    for (const status of [401, 503]) {
      const res = await request('/api/muse-search/threads', { DYNAMICNEKO: fetcher(async () => Response.json({ error: 'x' }, { status })) });
      expect(res.status).toBe(502);
      expect(await res.json()).toMatchObject({ errorCode: 'http_error', detail: expect.stringContaining(String(status)) });
    }
    expect((await request('/api/muse-search/threads', { DYNAMICNEKO: fetcher(async () => Response.json({ threads: 'x' })) })).status).toBe(502);
    expect((await request('/api/muse-search/threads', {})).status).toBe(503);
  });
});

describe('GET /api/muse-search/thread', () => {
  const get = (request: ReturnType<typeof setup>['request'], id: string | null, env: Record<string, unknown> = {}, githubId: number | null = ADMIN_ID) =>
    request('/api/muse-search/thread' + (id === null ? '' : '?threadId=' + encodeURIComponent(id)), env, githubId);
  it('未ログインは 401、管理者でなければ 403', async () => {
    const { request } = setup();
    expect((await get(request, 't', {}, null)).status).toBe(401);
    expect((await get(request, 't', {}, 2)).status).toBe(403);
  });
  it('スレッドIDが無い・空白・201文字以上は 400(上流を呼ばない)', async () => {
    const { fetcher, request } = setup();
    const up = fetcher(async () => Response.json(last));
    for (const id of [null, '', '   ', 'a'.repeat(201)]) expect((await get(request, id, { DYNAMICNEKO: up })).status).toBe(400);
    expect(up.fetch).not.toHaveBeenCalled();
  });
  it('最終書き込みを、空行で分けた段落にして返す(本文の全文も、日時・質問か回答か・チャットも)', async () => {
    const { fetcher, request } = setup();
    const up = fetcher(async () => Response.json(last));
    const res = await get(request, 't1', { DYNAMICNEKO: up });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ threadId: 't1', chatId: 'c1', role: 'assistant', createdAt: 100, truncated: false, paragraphs: ['一段落目\n二行目', '二段落目'] });
    expect((up.fetch.mock.calls[0] as unknown as [string])[0]).toBe('https://dynamicneko.internal/api/tree-view/muse-thread-last?threadId=t1');
  });
  it('長すぎる本文は10万文字で切り、truncated: true にする', async () => {
    const { fetcher, request } = setup();
    const body = await (await get(request, 't1', { DYNAMICNEKO: fetcher(async () => Response.json({ ...last, content: 'x'.repeat(100001) })) })).json() as { truncated: boolean; paragraphs: string[] };
    expect(body.truncated).toBe(true);
    expect(body.paragraphs.join('').length).toBe(100000);
  });
  it('上流の失敗は、空の本文にせず、理由つきで返す(404も 502。形式違いも 502。未設定は 503)', async () => {
    const { fetcher, request } = setup();
    for (const status of [401, 404]) {
      const res = await get(request, 't1', { DYNAMICNEKO: fetcher(async () => Response.json({ error: 'no' }, { status })) });
      expect(res.status).toBe(502);
      expect(await res.json()).toMatchObject({ errorCode: 'http_error', detail: expect.stringContaining(String(status)) });
    }
    expect((await get(request, 't1', { DYNAMICNEKO: fetcher(async () => Response.json({ content: 1 })) })).status).toBe(502);
    expect((await get(request, 't1', {})).status).toBe(503);
  });
});
