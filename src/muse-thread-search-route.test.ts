// POST /api/muse-search/thread-search(2026-11-20、ユーザー指定): スレッド検索の「検索したキー・ヒット件数・スレッドID」を記録する。
// 仮説: 管理者だけ。JSONだけ受ける。記録はログインユーザー本人の行(他人の名前では書けない)。
//   件数はサーバーがスレッドIDから数える。不正な入力は400、D1の障害・未設定は503で理由を返し、成功にしない。
import { describe, expect, it } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { createD1, createMuseSearchKeysSqlite } from './utils/museSearchKeys.testdb';

const JWT_SECRET = 'muse-thread-search-test';
const ADMIN_ID = 85157166;

function setup(options: { failOn?: RegExp; omitDb?: boolean } = {}) {
  const sqlite = createMuseSearchKeysSqlite();
  const db = createD1(sqlite, { failOn: options.failOn, intercept: (sql) => (sql.includes('user_sessions') ? { revoked_at: null } : undefined) });
  const post = async (body: unknown, opts: { githubId?: number | null; sub?: string; contentType?: string | null } = {}) => {
    const headers: Record<string, string> = {};
    if (opts.contentType !== null) headers['Content-Type'] = opts.contentType ?? 'application/json';
    const githubId = opts.githubId === undefined ? ADMIN_ID : opts.githubId;
    if (githubId !== null) headers.Authorization = 'Bearer ' + await createJWT({ sub: opts.sub ?? 'alice', github_id: githubId }, JWT_SECRET);
    return app.request('/api/muse-search/thread-search', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) }, { JWT_SECRET, ...(options.omitDb ? {} : { DB: db }), CF_DASHBOARD_ADMIN_GITHUB_IDS: String(ADMIN_ID) } as never);
  };
  const rows = () => sqlite.prepare('SELECT user_id, search_key, hit_count, thread_ids FROM muse_thread_search_log ORDER BY id').all();
  return { post, rows };
}

describe('POST /api/muse-search/thread-search', () => {
  it('未ログインは 401、管理者でなければ 403。記録しない', async () => {
    const { post, rows } = setup();
    expect((await post({ key: 'x', threadIds: [] }, { githubId: null })).status).toBe(401);
    expect((await post({ key: 'x', threadIds: [] }, { githubId: 2 })).status).toBe(403);
    expect(rows()).toEqual([]);
  });
  it('キーとスレッドIDを、ログインユーザー本人の行として記録し、件数を返す。no-store', async () => {
    const { post, rows } = setup();
    const res = await post({ key: 'Foo', threadIds: ['t1', 't2'] });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ recorded: true, hitCount: 2 });
    expect(rows()).toEqual([{ user_id: 'alice', search_key: 'foo', hit_count: 2, thread_ids: '["t1","t2"]' }]);
  });
  it('本文に userId や hitCount を入れても使わない(本人のID・数えた件数になる)', async () => {
    const { post, rows } = setup();
    await post({ key: 'x', threadIds: ['t1'], userId: 'someone-else', hitCount: 99 });
    expect(rows()).toEqual([{ user_id: 'alice', search_key: 'x', hit_count: 1, thread_ids: '["t1"]' }]);
  });
  it('JSONでない・壊れている・形が違う・キーが空は 4xx で、記録しない', async () => {
    const { post, rows } = setup();
    expect((await post('x', { contentType: 'text/plain' })).status).toBe(415);
    expect((await post('{', {})).status).toBe(400);
    expect((await post({ key: 'x' })).status).toBe(400);
    expect((await post({ key: 5, threadIds: [] })).status).toBe(400);
    expect((await post({ key: '  ', threadIds: [] })).status).toBe(400);
    expect((await post({ key: 'x', threadIds: [''] })).status).toBe(400);
    expect(rows()).toEqual([]);
  });
  it('D1の障害・未設定は 503 で理由を返す(recorded: true にしない)', async () => {
    const down = await setup({ failOn: /INSERT INTO muse_thread_search_log/ }).post({ key: 'x', threadIds: [] });
    expect(down.status).toBe(503);
    expect(await down.json()).toMatchObject({ recorded: false, errorCode: 'db_error', detail: expect.stringContaining('d1 down') });
    const missing = await setup({ omitDb: true }).post({ key: 'x', threadIds: [] });
    expect(missing.status).toBe(503);
    expect(await missing.json()).toMatchObject({ recorded: false, errorCode: 'db_missing' });
  });
});
