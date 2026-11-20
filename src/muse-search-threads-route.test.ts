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

function setup(options: { db?: Parameters<typeof createD1>[1]; omitDb?: boolean } = {}) {
  const sqlite = createMuseSearchKeysSqlite();
  const db = createD1(sqlite, { intercept: (sql) => (sql.includes('user_sessions') ? { revoked_at: null } : undefined), ...options.db });
  const fetcher = (respond: () => Promise<Response>) => ({ fetch: vi.fn(respond) });
  const request = async (path: string, env: Record<string, unknown> = {}, githubId: number | null = ADMIN_ID, sub = 'admin-user') => {
    const headers: Record<string, string> = {};
    if (githubId !== null) headers.Authorization = 'Bearer ' + await createJWT({ sub, github_id: githubId }, JWT_SECRET);
    return app.request(path, { headers }, { JWT_SECRET, ...(options.omitDb ? {} : { DB: db }), CF_DASHBOARD_ADMIN_GITHUB_IDS: String(ADMIN_ID), DYNAMICNEKO_WORKER_HMAC_SECRET: 's', ...env } as never);
  };
  /** 検索キーの記録(muse_search_key_log)に、そのユーザーのキーを1行足す。 */
  const addKey = (userId: string, key: string, at = '2026-11-19T00:00:00Z') => sqlite.prepare("INSERT INTO muse_search_key_log (user_id, search_key, ai_chat_count, tree_view_count, searched_at) VALUES (?, lower(?), 1, NULL, ?)").run(userId, key, at);
  return { sqlite, fetcher, request, addKey };
}
const plain = (text: string) => [{ text, hit: false }];
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
    expect(await res.json()).toEqual({ threadId: 't1', chatId: 'c1', role: 'assistant', createdAt: 100, truncated: false, paragraphs: [plain('一段落目\n二行目'), plain('二段落目')] });
    expect((up.fetch.mock.calls[0] as unknown as [string])[0]).toBe('https://dynamicneko.internal/api/tree-view/muse-thread-last?threadId=t1');
  });
  it('長すぎる本文は10万文字で切り、truncated: true にする', async () => {
    const { fetcher, request } = setup();
    const body = await (await get(request, 't1', { DYNAMICNEKO: fetcher(async () => Response.json({ ...last, content: 'x'.repeat(100001) })) })).json() as { truncated: boolean; paragraphs: Array<Array<{ text: string }>> };
    expect(body.truncated).toBe(true);
    expect(body.paragraphs.flat().map((x) => x.text).join('').length).toBe(100000);
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

// スレッド一覧の各回答(最終書き込み)に、閲覧ユーザーが持つキーワードを強調する(2026-11-19、ユーザー指定)。
// 「持つキーワード」は、閲覧ユーザー自身の検索キーの記録(muse_search_key_log)のキー。他のユーザーのキーは使わない。
describe('GET /api/muse-search/thread の強調', () => {
  const get = (request: ReturnType<typeof setup>['request'], env: Record<string, unknown>, sub = 'admin-user') => request('/api/muse-search/thread?threadId=t1', env, ADMIN_ID, sub);
  const content = { ...last, content: 'Workers の Static Assets を配信する。\n\n二段落目にも static と ASSETS が出る。' };
  const hits = (paragraph: Array<{ text: string; hit: boolean }>) => paragraph.filter((x) => x.hit).map((x) => x.text);
  type Body = { paragraphs: Array<Array<{ text: string; hit: boolean }>>; highlightError?: string };

  it('閲覧ユーザーが持つキーワードを、各段落で強調する(大文字小文字を区別せず、元の文字のまま)。強調の取得の失敗は無い(highlightError なし)', async () => {
    const { fetcher, request, addKey } = setup();
    addKey('admin-user', 'static');
    addKey('admin-user', 'Assets');
    const body = await (await get(request, { DYNAMICNEKO: fetcher(async () => Response.json(content)) })).json() as Body;
    expect(body.paragraphs).toHaveLength(2);
    expect(hits(body.paragraphs[0])).toEqual(['Static', 'Assets']);
    expect(hits(body.paragraphs[1])).toEqual(['static', 'ASSETS']);
    expect(body.paragraphs[0].map((x) => x.text).join('')).toBe('Workers の Static Assets を配信する。');
    expect(body.highlightError).toBeUndefined();
  });
  it('他のユーザーのキーは、強調に使わない(自分のキーが無ければ、強調なし)', async () => {
    const { fetcher, request, addKey } = setup();
    addKey('someone-else', 'static');
    addKey('someone-else', '配信');
    const body = await (await get(request, { DYNAMICNEKO: fetcher(async () => Response.json(content)) })).json() as Body;
    expect(body.paragraphs.flatMap(hits)).toEqual([]);
    expect(body.paragraphs.map((p) => p.length)).toEqual([1, 1]);
  });
  it('同じ本文でも、閲覧するユーザーごとに、そのユーザーのキーだけが強調される', async () => {
    const { fetcher, request, addKey } = setup();
    addKey('admin-user', 'static');
    addKey('someone-else', '配信');
    const up = { DYNAMICNEKO: fetcher(async () => Response.json(content)) };
    expect(((await (await get(request, up, 'admin-user')).json()) as Body).paragraphs.flatMap(hits)).toEqual(['Static', 'static']);
    expect(((await (await get(request, up, 'someone-else')).json()) as Body).paragraphs.flatMap(hits)).toEqual(['配信']);
  });
  it('キーの記録が読めない(失敗)・D1が未設定のときも、本文は返す(200)。ただし、強調できなかったことを、理由つきで返す(強調なしを「正常」に見せない)', async () => {
    const failing = setup({ db: { failOn: /FROM muse_search_key_log/ } });
    const res = await get(failing.request, { DYNAMICNEKO: failing.fetcher(async () => Response.json(content)) });
    expect(res.status).toBe(200);
    const body = await res.json() as Body;
    expect(body.paragraphs.flatMap(hits)).toEqual([]);
    expect(body.paragraphs.map((p) => p.map((x) => x.text).join(''))[0]).toBe('Workers の Static Assets を配信する。');
    expect(body.highlightError).toContain('d1 down');
    const none = setup({ omitDb: true });
    const noDb = await (await get(none.request, { DYNAMICNEKO: none.fetcher(async () => Response.json(content)) })).json() as Body;
    expect(noDb.highlightError).toContain('DB');
    expect(noDb.paragraphs.flatMap(hits)).toEqual([]);
  });
  it('上流の失敗は、今までどおり(強調のためにD1を読まない)', async () => {
    const { fetcher, request } = setup({ db: { failOn: /FROM muse_search_key_log/ } });
    const res = await get(request, { DYNAMICNEKO: fetcher(async () => Response.json({ error: 'x' }, { status: 502 })) });
    expect(res.status).toBe(502);
  });
});
