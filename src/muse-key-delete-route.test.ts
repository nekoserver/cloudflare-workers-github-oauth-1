// DELETE /api/muse-search/key?key=(2026-11-20、ユーザー指定): 🔑モーダルで左スワイプした行の検索キーを削除する。
// 仮説: 管理者だけ。ログインユーザー本人の、そのキーの記録(muse_search_key_log と、キーごとの回答の記録 muse_search_answer_log)だけを消す。
//   他のユーザーの同じキー・同じユーザーの別のキーは消さない。2つの表は、まとめて(片方だけ消えて残らない)。
//   キーが無ければ404。D1の障害・未設定は503で理由を返し、deleted: true にしない。
import { describe, expect, it } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { createD1, createMuseSearchKeysSqlite } from './utils/museSearchKeys.testdb';

const JWT_SECRET = 'muse-key-delete-test';
const ADMIN_ID = 85157166;

function setup(options: { failOn?: RegExp; omitDb?: boolean } = {}) {
  const sqlite = createMuseSearchKeysSqlite();
  const db = createD1(sqlite, { failOn: options.failOn, intercept: (sql) => (sql.includes('user_sessions') ? { revoked_at: null } : undefined) });
  const key = (user: string, k: string) => sqlite.prepare("INSERT INTO muse_search_key_log (user_id, search_key, ai_chat_count, tree_view_count, searched_at) VALUES (?, ?, 1, NULL, '2026-11-19T00:00:00Z')").run(user, k);
  const answer = (user: string, k: string, id: string) => sqlite.prepare("INSERT INTO muse_search_answer_log (user_id, search_key, answer_id, chat_id, thread_id, occurrences, preview, answer_created_at, searched_at) VALUES (?, ?, ?, 'c1', 't1', 1, 'p', 100, '2026-11-19T00:00:00Z')").run(user, k, id);
  key('alice', 'foo'); key('alice', 'foo'); key('alice', 'bar'); key('bob', 'foo');
  answer('alice', 'foo', 'a1'); answer('alice', 'bar', 'a2'); answer('bob', 'foo', 'a3');
  const del = async (query: string, opts: { githubId?: number | null; sub?: string } = {}) => {
    const headers: Record<string, string> = {};
    const githubId = opts.githubId === undefined ? ADMIN_ID : opts.githubId;
    if (githubId !== null) headers.Authorization = 'Bearer ' + await createJWT({ sub: opts.sub ?? 'alice', github_id: githubId }, JWT_SECRET);
    return app.request('/api/muse-search/key' + query, { method: 'DELETE', headers }, { JWT_SECRET, ...(options.omitDb ? {} : { DB: db }), CF_DASHBOARD_ADMIN_GITHUB_IDS: String(ADMIN_ID) } as never);
  };
  const keys = () => sqlite.prepare('SELECT user_id, search_key FROM muse_search_key_log ORDER BY id').all().map((r) => `${r.user_id}:${r.search_key}`);
  const answers = () => sqlite.prepare('SELECT user_id, search_key FROM muse_search_answer_log ORDER BY id').all().map((r) => `${r.user_id}:${r.search_key}`);
  return { del, keys, answers };
}

describe('DELETE /api/muse-search/key', () => {
  it('未ログインは 401、管理者でなければ 403。消さない', async () => {
    const { del, keys } = setup();
    expect((await del('?key=foo', { githubId: null })).status).toBe(401);
    expect((await del('?key=foo', { githubId: 2 })).status).toBe(403);
    expect(keys()).toHaveLength(4);
  });
  it('本人のそのキーの記録(キーの全部の行と、キーごとの回答の記録)だけを消す。他のユーザーの同じキー・別のキーは残る。no-store', async () => {
    const { del, keys, answers } = setup();
    const res = await del('?key=foo');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ deleted: true, keyRows: 2, answerRows: 1 });
    expect(keys()).toEqual(['alice:bar', 'bob:foo']);
    expect(answers()).toEqual(['alice:bar', 'bob:foo']);
  });
  it('他のユーザーのキーは、名前を指定しても消せない(本人の行だけが対象)', async () => {
    const { del, keys } = setup();
    expect((await del('?key=foo', { sub: 'carol' })).status).toBe(404);
    expect(keys()).toHaveLength(4);
  });
  it('キーが無ければ 404。キーの指定が無い・空・501文字は 400', async () => {
    const { del, keys } = setup();
    expect((await del('?key=none')).status).toBe(404);
    for (const q of ['', '?key=', '?key=%20%20', '?key=' + 'a'.repeat(501)]) expect((await del(q)).status).toBe(400);
    expect(keys()).toHaveLength(4);
  });
  it('一覧に出るキーと同じ綴りで指定できる(大文字小文字は、保存と同じ小文字にそろえて照合)', async () => {
    const { del, keys } = setup();
    expect((await del('?key=FOO')).status).toBe(200);
    expect(keys()).toEqual(['alice:bar', 'bob:foo']);
  });
  it('どちらかの削除が失敗したら、どちらの表も消えない(まとめて)。D1の障害は 503 で理由を返す', async () => {
    const { del, keys, answers } = setup({ failOn: /DELETE FROM muse_search_answer_log/ });
    const res = await del('?key=foo');
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ deleted: false, errorCode: 'db_error', detail: expect.stringContaining('d1 down') });
    expect(keys()).toHaveLength(4);
    expect(answers()).toHaveLength(3);
  });
  it('D1が無いときは 503', async () => {
    const res = await setup({ omitDb: true }).del('?key=foo');
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ deleted: false, errorCode: 'db_missing' });
  });
});
