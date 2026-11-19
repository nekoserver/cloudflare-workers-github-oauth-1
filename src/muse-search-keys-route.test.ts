// /muse-search の検索キーの記録と、🔑ボタンの一覧 API(GET /api/muse-search/keys、2026-11-19、ユーザー指定)。
// 仮説:
//   1. 検索が成功したら、キー・AIチャットの応答ログでの出現回数・tree-viewの会話ログでの出現回数・検索日時を、本体のD1に記録する。
//      一致が0件でも、検索したので記録する。検索が失敗した(上流の失敗・検索文の誤り)ときは記録しない。
//   2. 記録に失敗しても検索の結果は返す。ただし、成功に見せず、理由を応答で伝える(黙って捨てない)。
//   3. 一覧は管理者だけが読め、AIチャットでの出現回数の多い順に返す。読めなかったときは、空の一覧にせず、理由つきで失敗にする。
import { describe, expect, it, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { createD1, createMuseSearchKeysSqlite, type D1Options } from './utils/museSearchKeys.testdb';

const JWT_SECRET = 'muse-search-keys-test';
const ADMIN_ID = 85157166;
const USER = 'admin-user';
const post = { postId: 'a:user', chatId: 'c-00001', role: 'user', content: '前置き。静的アセットの質問です。', createdAt: 100, threadMark: false };

function setup(options: { db?: D1Options; omitDb?: boolean } = {}) {
  const sqlite = createMuseSearchKeysSqlite();
  const db = createD1(sqlite, { intercept: (sql) => (sql.includes('user_sessions') ? { revoked_at: null } : undefined), ...options.db });
  let n = 0;
  const share = (userId: string, answer: string, deletedAt: string | null = null) => {
    n += 1;
    sqlite.prepare('INSERT INTO ai_chat_shares (id, user_id, user_hash, question, answer, model, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run('s' + n, userId, 'h', 'q', answer, 'llama-4', deletedAt);
  };
  const rows = () => (sqlite.prepare('SELECT user_id, search_key, ai_chat_count, tree_view_count, searched_at FROM muse_search_key_log ORDER BY id').all() as Record<string, unknown>[]).map((r) => ({ ...r }));
  const fetcher = (respond: () => Promise<Response>) => ({ fetch: vi.fn(respond) });
  const request = async (path: string, env: Record<string, unknown> = {}, githubId: number | null = ADMIN_ID) => {
    const headers: Record<string, string> = {};
    if (githubId !== null) headers.Authorization = 'Bearer ' + await createJWT({ sub: USER, github_id: githubId }, JWT_SECRET);
    return app.request(path, { headers }, { JWT_SECRET, ...(options.omitDb ? {} : { DB: db }), CF_DASHBOARD_ADMIN_GITHUB_IDS: String(ADMIN_ID), DYNAMICNEKO_WORKER_HMAC_SECRET: 's', ...env } as never);
  };
  return { sqlite, share, rows, fetcher, request };
}
const q = (text: string) => '/api/muse-search?q=' + encodeURIComponent(text);
const ok = (body: Record<string, unknown> = { posts: [post], occurrenceCount: 12 }) => async () => Response.json(body);

describe('検索したら、検索キーを記録する', () => {
  it('キー・AIチャットでの出現回数・tree-viewでの出現回数・検索日時を記録し、応答にも出す', async () => {
    const { share, rows, fetcher, request } = setup();
    share(USER, '静的アセットは、静的アセットです。');
    share(USER, '静的アセット');
    share('someone-else', '静的アセット 静的アセット');
    share(USER, '静的アセット', '2026-11-01T00:00:00Z');
    const res = await request(q('静的アセット'), { DYNAMICNEKO: fetcher(ok()) });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toMatchObject({ count: 1, aiChatCount: 3, treeViewCount: 12, keyLogged: true });
    expect(rows()).toEqual([{ user_id: USER, search_key: '静的アセット', ai_chat_count: 3, tree_view_count: 12, searched_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) }]);
  });
  it('上流が tree-view の出現回数を返さなかったとき(古い版)は、0にせず NULL で記録し、nullで返す', async () => {
    const { rows, fetcher, request } = setup();
    const res = await request(q('k'), { DYNAMICNEKO: fetcher(ok({ posts: [post] })) });
    expect(await res.json()).toMatchObject({ treeViewCount: null, keyLogged: true });
    expect(rows()[0].tree_view_count).toBeNull();
  });
  it('一致が0件でも、検索したので記録する', async () => {
    const { share, rows, fetcher, request } = setup();
    share(USER, 'nothing');
    const res = await request(q('無い'), { DYNAMICNEKO: fetcher(ok({ posts: [], occurrenceCount: 0 })) });
    expect(await res.json()).toMatchObject({ count: 0, aiChatCount: 0, treeViewCount: 0, keyLogged: true });
    expect(rows()).toHaveLength(1);
  });
  it('検索が失敗したとき(上流の失敗・形式違い・検索文の誤り)は記録しない', async () => {
    const { rows, fetcher, request } = setup();
    expect((await request(q('x'), { DYNAMICNEKO: fetcher(async () => Response.json({ ok: false }, { status: 401 })) })).status).toBe(502);
    expect((await request(q('x'), { DYNAMICNEKO: fetcher(async () => Response.json({ posts: 'x' })) })).status).toBe(502);
    expect((await request(q('x'), {})).status).toBe(503);
    expect((await request(q('   '), { DYNAMICNEKO: fetcher(ok()) })).status).toBe(400);
    expect((await request(q('a'.repeat(501)), { DYNAMICNEKO: fetcher(ok()) })).status).toBe(400);
    expect(rows()).toEqual([]);
  });
  it('同じキーを何度検索しても、行を追記する(上書きしない)', async () => {
    const { rows, fetcher, request } = setup();
    for (let i = 0; i < 3; i++) await request(q('K'), { DYNAMICNEKO: fetcher(ok()) });
    expect(rows().map((r) => r.search_key)).toEqual(['k', 'k', 'k']);
  });
});

describe('記録に失敗しても、検索の結果は返す(理由を伝える)', () => {
  const failures: Array<[string, D1Options | { omitDb: true }, RegExp]> = [
    ['記録の書き込みが失敗', { failOn: /INSERT INTO muse_search_key_log/ }, /d1 down/],
    ['AIチャットでの出現回数を数えるのが失敗', { failOn: /FROM ai_chat_shares/ }, /d1 down/],
  ];
  for (const [name, dbOptions, reason] of failures) {
    it(name, async () => {
      const { rows, fetcher, request } = setup({ db: dbOptions as D1Options });
      const res = await request(q('k'), { DYNAMICNEKO: fetcher(ok()) });
      expect(res.status).toBe(200);
      const body = await res.json() as { count: number; posts: unknown[]; keyLogged: boolean; keyLogError: string };
      expect(body.count).toBe(1);
      expect(body.posts).toHaveLength(1);
      expect(body.keyLogged).toBe(false);
      expect(body.keyLogError).toMatch(reason);
      expect(rows()).toEqual([]);
    });
  }
  it('D1が未設定でも、検索の結果は返し、理由を伝える', async () => {
    const { fetcher, request } = setup({ omitDb: true });
    const res = await request(q('k'), { DYNAMICNEKO: fetcher(ok()) });
    expect(res.status).toBe(200);
    const body = await res.json() as { count: number; aiChatCount: number | null; treeViewCount: number | null; keyLogged: boolean; keyLogError: string };
    expect(body).toMatchObject({ count: 1, aiChatCount: null, treeViewCount: 12, keyLogged: false });
    expect(body.keyLogError).toContain('DB');
  });
});

describe('GET /api/muse-search/keys(🔑ボタンの一覧)', () => {
  const seed = async (fetcher: ReturnType<typeof setup>['fetcher'], request: ReturnType<typeof setup>['request'], share: ReturnType<typeof setup>['share']) => {
    share(USER, 'alpha alpha alpha');
    share(USER, 'beta');
    await request(q('beta'), { DYNAMICNEKO: fetcher(ok({ posts: [post], occurrenceCount: 9 })) });
    await request(q('alpha'), { DYNAMICNEKO: fetcher(ok({ posts: [post], occurrenceCount: 2 })) });
    await request(q('gamma'), { DYNAMICNEKO: fetcher(ok({ posts: [], occurrenceCount: 40 })) });
  };
  it('未ログインは 401、管理者でなければ 403', async () => {
    const { request } = setup();
    expect((await request('/api/muse-search/keys', {}, null)).status).toBe(401);
    expect((await request('/api/muse-search/keys', {}, 2)).status).toBe(403);
  });
  it('AIチャットでの出現回数の多い順に、tree-viewでの出現回数・検索回数・検索日時とともに返す', async () => {
    const { fetcher, request, share } = setup();
    await seed(fetcher, request, share);
    await request(q('alpha'), { DYNAMICNEKO: fetcher(ok({ posts: [post], occurrenceCount: 5 })) });
    const res = await request('/api/muse-search/keys');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json() as { keys: Array<Record<string, unknown>> };
    expect(body.keys.map((k) => [k.searchKey, k.aiChatCount, k.treeViewCount, k.searchCount])).toEqual([
      ['alpha', 3, 5, 2],
      ['beta', 1, 9, 1],
      ['gamma', 0, 40, 1],
    ]);
    expect(body.keys[0]).toMatchObject({ firstSearchedAt: expect.any(String), lastSearchedAt: expect.any(String) });
  });
  it('他のユーザーの検索キーは返さない', async () => {
    const { sqlite, request } = setup();
    sqlite.prepare("INSERT INTO muse_search_key_log (user_id, search_key, ai_chat_count, tree_view_count, searched_at) VALUES ('someone-else', 'secret', 99, 99, '2026-11-19T00:00:00Z')").run();
    expect(await (await request('/api/muse-search/keys')).json()).toEqual({ keys: [] });
  });
  it('D1が未設定なら、空の一覧にせず、理由つきで 503 にする', async () => {
    const { request } = setup({ omitDb: true });
    const res = await request('/api/muse-search/keys');
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ detail: expect.stringContaining('DB') });
  });
  it('読めなかったときは、空の一覧にせず、理由つきで 503 にする', async () => {
    const { request } = setup({ db: { failOn: /FROM muse_search_key_log/ } });
    const res = await request('/api/muse-search/keys');
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: expect.any(String), detail: expect.stringContaining('d1 down') });
  });
});

// 🗒️ボタン(2026-11-19、ユーザー指定): 回答ごとの出現回数を本体のD1(muse_search_answer_log)に記録し、スレッドごとに一覧する。
const answerHit = (over: Record<string, unknown> = {}) => ({ answerId: 'a1', chatId: 'c1', threadId: 't1', occurrences: 2, preview: '前…静的…後', createdAt: 100, ...over });
const answerRows = (sqlite: ReturnType<typeof setup>['sqlite']) => (sqlite.prepare('SELECT user_id, search_key, answer_id, chat_id, thread_id, occurrences FROM muse_search_answer_log ORDER BY id').all() as Record<string, unknown>[]).map((r) => ({ ...r }));

describe('検索したら、回答ごとの出現回数を記録する', () => {
  it('上流の answers を、キー・検索日時とともに記録し、応答に answersLogged を出す', async () => {
    const { sqlite, fetcher, request } = setup();
    const res = await request(q('Static'), { DYNAMICNEKO: fetcher(ok({ posts: [post], occurrenceCount: 3, answers: [answerHit(), answerHit({ answerId: 'a2', chatId: 'c2', threadId: null, occurrences: 1 })] })) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ count: 1, keyLogged: true, answersLogged: true, answersCount: 2 });
    expect(answerRows(sqlite)).toEqual([
      { user_id: USER, search_key: 'static', answer_id: 'a1', chat_id: 'c1', thread_id: 't1', occurrences: 2 },
      { user_id: USER, search_key: 'static', answer_id: 'a2', chat_id: 'c2', thread_id: null, occurrences: 1 },
    ]);
  });
  it('上流が answers を返さない(古い版)ときは、検索キーは記録し、回答の記録は理由つきで失敗として返す', async () => {
    const { rows, sqlite, fetcher, request } = setup();
    const body = await (await request(q('k'), { DYNAMICNEKO: fetcher(ok()) })).json() as Record<string, unknown>;
    expect(body).toMatchObject({ keyLogged: true, answersLogged: false });
    expect(String(body.answersLogError)).toContain('answers');
    expect(rows()).toHaveLength(1);
    expect(answerRows(sqlite)).toEqual([]);
  });
  it('回答の記録に失敗しても、検索の結果と検索キーの記録は残る(理由を伝える)', async () => {
    const { rows, fetcher, request } = setup({ db: { failOn: /INSERT INTO muse_search_answer_log/ } });
    const res = await request(q('k'), { DYNAMICNEKO: fetcher(ok({ posts: [post], occurrenceCount: 1, answers: [answerHit()] })) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ count: 1, keyLogged: true, answersLogged: false, answersLogError: expect.stringContaining('d1 down') });
    expect(rows()).toHaveLength(1);
  });
  it('上流の answers の形が違えば、検索全体を 502 にする(形の違うデータを記録しない)', async () => {
    const { sqlite, fetcher, request } = setup();
    const res = await request(q('k'), { DYNAMICNEKO: fetcher(ok({ posts: [post], answers: [{ answerId: 1 }] })) });
    expect(res.status).toBe(502);
    expect(answerRows(sqlite)).toEqual([]);
  });
});

describe('GET /api/muse-search/answers(🗒️ボタンの一覧)', () => {
  it('未ログインは 401、管理者でなければ 403', async () => {
    const { request } = setup();
    expect((await request('/api/muse-search/answers', {}, null)).status).toBe(401);
    expect((await request('/api/muse-search/answers', {}, 2)).status).toBe(403);
  });
  it('全キー合算で、スレッドごとに出現回数の多い順に、回答を並べて返す', async () => {
    const { fetcher, request } = setup();
    const answers1 = [answerHit({ answerId: 'a1', occurrences: 2 }), answerHit({ answerId: 'a2', occurrences: 5 }), answerHit({ answerId: 'b1', chatId: 'c9', threadId: 't2', occurrences: 1 })];
    await request(q('alpha'), { DYNAMICNEKO: fetcher(ok({ posts: [post], occurrenceCount: 1, answers: answers1 })) });
    await request(q('beta'), { DYNAMICNEKO: fetcher(ok({ posts: [post], occurrenceCount: 1, answers: [answerHit({ answerId: 'b1', chatId: 'c9', threadId: 't2', occurrences: 9 })] })) });
    await request(q('alpha'), { DYNAMICNEKO: fetcher(ok({ posts: [post], occurrenceCount: 1, answers: answers1 })) });
    const res = await request('/api/muse-search/answers');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json() as { threads: Array<{ threadId: string | null; totalOccurrences: number; answers: Array<{ answerId: string; occurrences: number; searchKeys: string[] }> }> };
    expect(body.threads.map((t) => [t.threadId, t.totalOccurrences, t.answers.map((a) => [a.answerId, a.occurrences, a.searchKeys])])).toEqual([
      ['t2', 10, [['b1', 10, ['alpha', 'beta']]]],
      ['t1', 7, [['a2', 5, ['alpha']], ['a1', 2, ['alpha']]]],
    ]);
  });
  it('他のユーザーの記録は返さない。記録が無ければ空', async () => {
    const { sqlite, request } = setup();
    sqlite.prepare("INSERT INTO muse_search_answer_log (user_id, search_key, answer_id, chat_id, thread_id, occurrences, preview, answer_created_at, searched_at) VALUES ('someone-else','k','a','c','t',9,'p',1,'2026-11-19T00:00:00Z')").run();
    expect(await (await request('/api/muse-search/answers')).json()).toEqual({ threads: [] });
  });
  it('D1が未設定・読み出しの失敗は、空の一覧にせず、理由つきで 503 にする', async () => {
    const none = await setup({ omitDb: true }).request('/api/muse-search/answers');
    expect(none.status).toBe(503);
    expect(await none.json()).toMatchObject({ detail: expect.stringContaining('DB') });
    const broken = await setup({ db: { failOn: /FROM muse_search_answer_log/ } }).request('/api/muse-search/answers');
    expect(broken.status).toBe(503);
    expect(await broken.json()).toMatchObject({ error: expect.any(String), detail: expect.stringContaining('d1 down') });
  });
});
