// /muse-search の👤ボタン用のルート(2026-11-19、ユーザー指定)。
//   GET  /api/muse-search/handle … ログインユーザーのユーザー名と、登録済みのハンドルネーム(無ければ null)。
//   GET  /api/muse-search/handle/check?name= … 一文字入力するごとの照合。他のユーザーの名前と一致しなければ available。
//   POST /api/muse-search/handle { name } … 登録(自分の名前は変更できる)。
// 仮説: 管理者だけ。ユーザー名は、このアプリへのログインユーザー(JWTの sub)。JSON以外のPOSTは断る(フォームからの勝手な登録を防ぐ)。
// 失敗は理由つきで返し、「使える」「登録した」に見せない。誰の名前と一致したかは返さない。
import { describe, expect, it } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { createD1, createMuseSearchKeysSqlite, type D1Options } from './utils/museSearchKeys.testdb';

const JWT_SECRET = 'muse-handle-test';
const ADMIN_ID = 85157166;
const USER = 'nekoserver';

function setup(options: { db?: D1Options; omitDb?: boolean } = {}) {
  const sqlite = createMuseSearchKeysSqlite();
  const db = createD1(sqlite, { intercept: (sql) => (sql.includes('user_sessions') ? { revoked_at: null } : undefined), ...options.db });
  const rows = () => (sqlite.prepare('SELECT user_id, user_name, handle_name, handle_key FROM muse_user_handles ORDER BY user_id').all() as Record<string, unknown>[]).map((r) => ({ ...r }));
  const request = async (path: string, init: { method?: string; body?: unknown; contentType?: string | null; githubId?: number | null; sub?: string } = {}) => {
    const headers: Record<string, string> = {};
    if (init.githubId !== null) headers.Authorization = 'Bearer ' + await createJWT({ sub: init.sub ?? USER, github_id: init.githubId ?? ADMIN_ID }, JWT_SECRET);
    let body: string | undefined;
    if (init.body !== undefined) {
      body = typeof init.body === 'string' ? init.body : JSON.stringify(init.body);
      if (init.contentType !== null) headers['Content-Type'] = init.contentType ?? 'application/json';
    }
    return app.request(path, { method: init.method ?? 'GET', headers, body }, { JWT_SECRET, ...(options.omitDb ? {} : { DB: db }), CF_DASHBOARD_ADMIN_GITHUB_IDS: String(ADMIN_ID) } as never);
  };
  const post = (name: unknown, init: Parameters<typeof request>[1] = {}) => request('/api/muse-search/handle', { method: 'POST', body: { name }, ...init });
  const check = (name: string, init: Parameters<typeof request>[1] = {}) => request('/api/muse-search/handle/check?name=' + encodeURIComponent(name), init);
  return { sqlite, rows, request, post, check };
}

describe('認可', () => {
  it('3つとも、未ログインは 401、管理者でなければ 403', async () => {
    const { request, post, check } = setup();
    expect((await request('/api/muse-search/handle', { githubId: null })).status).toBe(401);
    expect((await request('/api/muse-search/handle', { githubId: 2 })).status).toBe(403);
    expect((await check('a', { githubId: null })).status).toBe(401);
    expect((await check('a', { githubId: 2 })).status).toBe(403);
    expect((await post('a', { githubId: null })).status).toBe(401);
    expect((await post('a', { githubId: 2 })).status).toBe(403);
  });
});

describe('GET /api/muse-search/handle', () => {
  it('登録が無ければ、ユーザー名(ログインユーザー)と handle: null。登録後は、その名前を返す。no-store', async () => {
    const { request, post } = setup();
    const none = await request('/api/muse-search/handle');
    expect(none.status).toBe(200);
    expect(none.headers.get('cache-control')).toBe('no-store');
    expect(await none.json()).toEqual({ userName: USER, handle: null });
    await post('Neko');
    expect(await (await request('/api/muse-search/handle')).json()).toMatchObject({ userName: USER, handle: { handleName: 'Neko', userName: USER } });
  });
  it('他のユーザーの登録は返さない(自分の分だけ)', async () => {
    const { request, post } = setup();
    await post('Other', { sub: 'someone-else' });
    expect(await (await request('/api/muse-search/handle')).json()).toEqual({ userName: USER, handle: null });
  });
  it('D1が未設定・読み出しの失敗は、「未登録」にせず、理由つきで 503', async () => {
    const none = await setup({ omitDb: true }).request('/api/muse-search/handle');
    expect(none.status).toBe(503);
    expect(await none.json()).toMatchObject({ detail: expect.stringContaining('DB') });
    const broken = await setup({ db: { failOn: /FROM muse_user_handles/ } }).request('/api/muse-search/handle');
    expect(broken.status).toBe(503);
    expect(await broken.json()).toMatchObject({ detail: expect.stringContaining('d1 down') });
  });
});

describe('GET /api/muse-search/handle/check(一文字ごとの照合)', () => {
  it('他のユーザーの名前と一致しなければ available。大文字小文字・全角半角の違いだけの一致は taken。誰の名前かは返さない。no-store', async () => {
    const { post, check } = setup();
    await post('Neko', { sub: 'someone-else' });
    const free = await check('Nek');
    expect(free.status).toBe(200);
    expect(free.headers.get('cache-control')).toBe('no-store');
    expect(await free.json()).toEqual({ available: true, status: 'available' });
    for (const typed of ['Neko', 'neko', 'ＮＥＫＯ']) expect(await (await check(typed)).json()).toEqual({ available: false, status: 'taken' });
  });
  it('自分の今の名前と同じなら same(登録できない)。別の名前なら available', async () => {
    const { post, check } = setup();
    await post('Neko');
    expect(await (await check('neko')).json()).toEqual({ available: false, status: 'same' });
    expect(await (await check('Neko2')).json()).toEqual({ available: true, status: 'available' });
  });
  it('名前が無い・空白だけ・21文字以上・制御文字は、available: false と理由(D1は見ない)', async () => {
    const { request, check } = setup({ db: { failOn: /FROM muse_user_handles/ } });
    expect(await (await request('/api/muse-search/handle/check')).json()).toEqual({ available: false, status: 'empty' });
    expect(await (await check('   ')).json()).toEqual({ available: false, status: 'empty' });
    expect(await (await check('あ'.repeat(21))).json()).toEqual({ available: false, status: 'too_long' });
    expect(await (await check('a\nb')).json()).toEqual({ available: false, status: 'invalid_chars' });
  });
  it('D1が未設定・読み出しの失敗は、「使える」にせず、理由つきで 503', async () => {
    const none = await setup({ omitDb: true }).check('neko');
    expect(none.status).toBe(503);
    expect(await none.json()).toMatchObject({ available: false, detail: expect.stringContaining('DB') });
    const broken = await setup({ db: { failOn: /FROM muse_user_handles/ } }).check('neko');
    expect(broken.status).toBe(503);
    expect(await broken.json()).toMatchObject({ available: false, detail: expect.stringContaining('d1 down') });
  });
});

describe('POST /api/muse-search/handle(登録)', () => {
  it('登録する。ユーザー名(ログインユーザー)も一緒にD1へ記録し、登録した内容を返す', async () => {
    const { post, rows } = setup();
    const res = await post('  Neko さん ');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toMatchObject({ handle: { userName: USER, handleName: 'Neko さん' } });
    expect(rows()).toEqual([{ user_id: USER, user_name: USER, handle_name: 'Neko さん', handle_key: 'neko さん' }]);
  });
  it('自分の名前は、あとから別の名前に変えられる(1人1つ)', async () => {
    const { post, rows } = setup();
    await post('First');
    expect((await post('Second')).status).toBe(200);
    expect(rows()).toEqual([{ user_id: USER, user_name: USER, handle_name: 'Second', handle_key: 'second' }]);
  });
  it('他のユーザーが登録済みの名前は 409(taken)で、何も書かない。自分の今の名前と同じなら 409(same)', async () => {
    const { post, rows } = setup();
    await post('Neko', { sub: 'someone-else' });
    const taken = await post('ＮＥＫＯ');
    expect(taken.status).toBe(409);
    expect(await taken.json()).toMatchObject({ status: 'taken', error: expect.any(String) });
    expect(rows().map((r) => r.user_id)).toEqual(['someone-else']);
    await post('Mine');
    const same = await post('mine');
    expect(same.status).toBe(409);
    expect(await same.json()).toMatchObject({ status: 'same' });
  });
  it('検査に通らない名前は 400(理由つき)。何も書かない', async () => {
    const { post, rows } = setup();
    for (const [name, code] of [['', 'empty'], ['   ', 'empty'], ['あ'.repeat(21), 'too_long'], ['a\nb', 'invalid_chars']] as const) {
      const res = await post(name);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ status: code });
    }
    expect(rows()).toEqual([]);
  });
  it('JSON以外のPOST(フォームなど)は 415。本文が壊れている・name が文字でないときは 400。何も書かない', async () => {
    const { request, post, rows } = setup();
    expect((await request('/api/muse-search/handle', { method: 'POST', body: 'name=Neko', contentType: 'application/x-www-form-urlencoded' })).status).toBe(415);
    expect((await request('/api/muse-search/handle', { method: 'POST', body: JSON.stringify({ name: 'Neko' }), contentType: 'text/plain' })).status).toBe(415);
    expect((await request('/api/muse-search/handle', { method: 'POST', body: '{broken', contentType: 'application/json' })).status).toBe(400);
    expect((await post(123)).status).toBe(400);
    expect((await post(null)).status).toBe(400);
    expect((await request('/api/muse-search/handle', { method: 'POST', body: '[]' })).status).toBe(400);
    expect(rows()).toEqual([]);
  });
  it('D1が未設定・書き込みの失敗は、「登録した」にせず、理由つきで 503', async () => {
    const none = await setup({ omitDb: true }).post('Neko');
    expect(none.status).toBe(503);
    expect(await none.json()).toMatchObject({ detail: expect.stringContaining('DB') });
    const failing = setup({ db: { failOn: /INSERT INTO muse_user_handles/ } });
    const res = await failing.post('Neko');
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ detail: expect.stringContaining('d1 down') });
    expect(failing.rows()).toEqual([]);
  });
});
