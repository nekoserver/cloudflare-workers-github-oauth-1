// GET /api/muse-search/chat?chatId=(2026-11-20、ユーザー指定): 検索結果のチャットIDのリンクを押したときに、そのチャットの質問と回答をセットで返す。
// 仮説: 管理者だけ。dynamicneko の GET /api/tree-view/muse-chat を署名付きで呼び、質問と回答を、やりとりの順に、段落ごとの強調区間にして返す。
//   強調は、閲覧ユーザー自身のキーだけ(他のユーザーのキーは使わない)。キーを読めなくても本文は返し、強調できなかった理由を highlightError で返す。
//   上流の失敗は、空のチャットにせず理由つきで返す。長すぎる本文は10万文字で切る。
import { describe, expect, it, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { createD1, createMuseSearchKeysSqlite } from './utils/museSearchKeys.testdb';

const JWT_SECRET = 'muse-chat-route-test';
const ADMIN_ID = 85157166;

function setup(options: { failOn?: RegExp; omitDb?: boolean } = {}) {
  const sqlite = createMuseSearchKeysSqlite();
  const db = createD1(sqlite, { failOn: options.failOn, intercept: (sql) => (sql.includes('user_sessions') ? { revoked_at: null } : undefined) });
  const addKey = (user: string, key: string) => sqlite.prepare("INSERT INTO muse_search_key_log (user_id, search_key, ai_chat_count, tree_view_count, searched_at) VALUES (?, lower(?), 1, NULL, '2026-11-19T00:00:00Z')").run(user, key);
  const upstream = (respond: () => Promise<Response>) => ({ fetch: vi.fn(respond) });
  const get = async (query: string, env: Record<string, unknown> = {}, githubId: number | null = ADMIN_ID, sub = 'alice') => {
    const headers: Record<string, string> = {};
    if (githubId !== null) headers.Authorization = 'Bearer ' + await createJWT({ sub, github_id: githubId }, JWT_SECRET);
    return app.request('/api/muse-search/chat' + query, { headers }, { JWT_SECRET, ...(options.omitDb ? {} : { DB: db }), CF_DASHBOARD_ADMIN_GITHUB_IDS: String(ADMIN_ID), DYNAMICNEKO_WORKER_HMAC_SECRET: 's', ...env } as never);
  };
  return { addKey, upstream, get };
}
const plain = (text: string) => [{ text, hit: false }];
const chat = { chatId: 'c1', posts: [
  { answerId: 'a1', role: 'user', content: '静的アセットとは?\n\n詳しく', createdAt: 100 },
  { answerId: 'a1', role: 'assistant', content: 'Workers の Static Assets です', createdAt: 101 },
] };

describe('GET /api/muse-search/chat', () => {
  it('未ログインは 401、管理者でなければ 403', async () => {
    const { get } = setup();
    expect((await get('?chatId=c1', {}, null)).status).toBe(401);
    expect((await get('?chatId=c1', {}, 2)).status).toBe(403);
  });
  it('チャットIDが無い・空白・201文字以上は 400(上流を呼ばない)', async () => {
    const { upstream, get } = setup();
    const up = upstream(async () => Response.json(chat));
    for (const q of ['', '?chatId=', '?chatId=%20', '?chatId=' + 'a'.repeat(201)]) expect((await get(q, { DYNAMICNEKO: up })).status).toBe(400);
    expect(up.fetch).not.toHaveBeenCalled();
  });
  it('質問と回答を、やりとりの順に、段落に分けて返す(役割・時刻つき)。署名付きで上流を呼ぶ。no-store', async () => {
    const { upstream, get } = setup();
    const up = upstream(async () => Response.json(chat));
    const res = await get('?chatId=c1', { DYNAMICNEKO: up });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ chatId: 'c1', posts: [
      { role: 'user', createdAt: 100, truncated: false, paragraphs: [plain('静的アセットとは?'), plain('詳しく')] },
      { role: 'assistant', createdAt: 101, truncated: false, paragraphs: [plain('Workers の Static Assets です')] },
    ] });
    expect((up.fetch.mock.calls[0] as unknown as [string])[0]).toBe('https://dynamicneko.internal/api/tree-view/muse-chat?chatId=c1');
  });
  it('閲覧ユーザー自身のキーだけを、質問にも回答にも強調する。他のユーザーのキーは使わない', async () => {
    const { addKey, upstream, get } = setup();
    addKey('alice', 'static assets');
    addKey('bob', 'workers');
    const up = upstream(async () => Response.json(chat));
    const body = await (await get('?chatId=c1', { DYNAMICNEKO: up })).json() as { posts: Array<{ paragraphs: Array<Array<{ text: string; hit: boolean }>> }> };
    const hits = body.posts.map((p) => p.paragraphs.flat().filter((s) => s.hit).map((s) => s.text));
    expect(hits).toEqual([[], ['Static Assets']]);
  });
  it('長すぎる本文は、投稿ごとに10万文字で切り、その投稿だけ truncated: true にする', async () => {
    const { upstream, get } = setup();
    const up = upstream(async () => Response.json({ chatId: 'c1', posts: [{ answerId: 'a', role: 'user', content: 'q', createdAt: 1 }, { answerId: 'a', role: 'assistant', content: 'あ'.repeat(100001), createdAt: 2 }] }));
    const body = await (await get('?chatId=c1', { DYNAMICNEKO: up })).json() as { posts: Array<{ truncated: boolean; paragraphs: Array<Array<{ text: string }>> }> };
    expect(body.posts.map((p) => p.truncated)).toEqual([false, true]);
    expect(body.posts[1].paragraphs[0][0].text.length).toBe(100000);
  });
  it('キーの記録が読めない・D1が未設定のときも、本文は返す(200)。強調できなかった理由を highlightError で返す(成功に見せない)', async () => {
    const { upstream, get } = setup({ failOn: /FROM muse_search_key_log/ });
    const up = upstream(async () => Response.json(chat));
    const res = await get('?chatId=c1', { DYNAMICNEKO: up });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ chatId: 'c1', highlightError: expect.stringContaining('d1 down') });
    const missing = await setup({ omitDb: true }).get('?chatId=c1', { DYNAMICNEKO: up });
    expect(await missing.json()).toMatchObject({ highlightError: expect.stringContaining('未設定') });
  });
  it('上流の失敗は、空のチャットにせず、理由つきで返す(404・401・503は 502、形式違い・投稿が空も 502、未設定は 503)', async () => {
    const { upstream, get } = setup();
    for (const status of [404, 401, 503]) {
      const res = await get('?chatId=c1', { DYNAMICNEKO: upstream(async () => Response.json({ error: 'x' }, { status })) });
      expect(res.status).toBe(502);
      expect(await res.json()).toMatchObject({ errorCode: 'http_error', detail: expect.stringContaining(String(status)) });
    }
    for (const bad of [{ unexpected: true }, { chatId: 'c1', posts: [] }, { chatId: 'c1', posts: [{ role: 'x', content: 'a', createdAt: 1, answerId: 'a' }] }]) {
      expect((await get('?chatId=c1', { DYNAMICNEKO: upstream(async () => Response.json(bad)) })).status).toBe(502);
    }
    expect((await get('?chatId=c1', {})).status).toBe(503);
    expect((await get('?chatId=c1', { DYNAMICNEKO: upstream(async () => Response.json(chat)), DYNAMICNEKO_WORKER_HMAC_SECRET: '' })).status).toBe(503);
  });
});
