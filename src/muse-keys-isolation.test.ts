// キーワードの所有(2026-11-19、ユーザー指定「各ページでそれらのキーがそのページを閲覧しているユーザーと異なる場合には表示されないように」)。
// キーワードは、ログインユーザー(JWTの sub = user_id 列)の所有。どのページ(経路)でも、閲覧ユーザーと所有が異なるキーは、出さない・使わない。
// 経路は4つ: 🔑(検索キーの一覧)、🗒️・📅(回答の一覧のキー)、回答の全文の強調、スレッド一覧の回答の強調。
// 仮説:
//   1. ユーザーごとに、4つの経路のすべてで、そのユーザー自身のキーだけが見える。他のユーザーのキーは、どこにも出ない・強調に使われない。
//   2. 記録のないユーザーには、どの経路にも、何も出ない。
//   3. 既存のキーをすべて nekoserver の所有にするSQL(0198)を流したあとは、nekoserver にはすべてのキーが見え、ほかのユーザーには何も見えない。
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import app from './index';
import { createJWT } from './utils/jwt';
import { createD1, createMuseSearchKeysSqlite } from './utils/museSearchKeys.testdb';

const JWT_SECRET = 'muse-keys-isolation-test';
const ADMIN_ID = 85157166;
const OWNER = 'nekoserver';
const OTHER = 'someone-else';
const NOBODY = 'nobody';
const SQL = readFileSync('migrations/0198_assign_muse_keys_to_nekoserver.sql', 'utf8');

function setup() {
  const sqlite = createMuseSearchKeysSqlite();
  const db = createD1(sqlite, { intercept: (sql) => (sql.includes('user_sessions') ? { revoked_at: null } : undefined) });
  const key = (user: string, k: string) => sqlite.prepare("INSERT INTO muse_search_key_log (user_id, search_key, ai_chat_count, tree_view_count, searched_at) VALUES (?, ?, 1, NULL, '2026-11-19T00:00:00Z')").run(user, k);
  const answer = (user: string, k: string, id: string) => sqlite.prepare("INSERT INTO muse_search_answer_log (user_id, search_key, answer_id, chat_id, thread_id, occurrences, preview, answer_created_at, searched_at) VALUES (?, ?, ?, 'c1', 't1', 2, 'p', 100, '2026-11-19T00:00:00Z')").run(user, k, id);
  key(OWNER, 'alpha'); answer(OWNER, 'alpha', 'a1');
  key(OTHER, 'beta'); answer(OTHER, 'beta', 'a2');
  const upstream = {
    fetch: vi.fn(async (url: string) => {
      if (url.includes('muse-answer')) return Response.json({ answerId: new URL(url).searchParams.get('answerId'), chatId: 'c1', content: 'alpha と beta が出る', createdAt: 100 });
      return Response.json({ threadId: 't1', chatId: 'c1', role: 'assistant', content: 'alpha と beta が出る', createdAt: 100 });
    }),
  };
  const call = async (path: string, sub: string) => {
    const token = await createJWT({ sub, github_id: ADMIN_ID }, JWT_SECRET);
    const res = await app.request(path, { headers: { Authorization: 'Bearer ' + token } }, { JWT_SECRET, DB: db, CF_DASHBOARD_ADMIN_GITHUB_IDS: String(ADMIN_ID), DYNAMICNEKO: upstream, DYNAMICNEKO_WORKER_HMAC_SECRET: 's' } as never);
    return { status: res.status, body: await res.json() as Record<string, any> };
  };
  /** 4つの経路で、そのユーザーに見えるキー(🔑の一覧のキー、🗒️のキー、回答の全文の強調のキー、スレッド一覧の回答の強調された語)。 */
  const visible = async (sub: string) => {
    const keys = (await call('/api/muse-search/keys', sub)).body.keys.map((k: { searchKey: string }) => k.searchKey).sort();
    const chats = (await call('/api/muse-search/answers', sub)).body.chats as Array<{ answers: Array<{ answerId: string; searchKeys: string[] }> }>;
    const answerKeys = chats.flatMap((c) => c.answers).flatMap((a) => a.searchKeys).sort();
    const answerIds = chats.flatMap((c) => c.answers).map((a) => a.answerId).sort();
    const a1 = await call('/api/muse-search/answer?answerId=a1', sub);
    const a2 = await call('/api/muse-search/answer?answerId=a2', sub);
    const detail = (r: { status: number; body: Record<string, any> }) => (r.status === 200 ? { keys: r.body.keys as string[], hits: (r.body.segments as Array<{ text: string; hit: boolean }>).filter((x) => x.hit).map((x) => x.text) } : r.status);
    const thread = (await call('/api/muse-search/thread?threadId=t1', sub)).body.paragraphs as Array<Array<{ text: string; hit: boolean }>>;
    return { keys, answerKeys, answerIds, a1: detail(a1), a2: detail(a2), threadHits: thread.flat().filter((x) => x.hit).map((x) => x.text) };
  };
  return { sqlite, visible };
}

describe('4つの経路で、閲覧ユーザーと所有が異なるキーは出ない', () => {
  it('nekoserver には、自分のキー(alpha)だけが見える。他のユーザーのキー(beta)は、どの経路にも出ない・強調に使われない', async () => {
    const { visible } = setup();
    expect(await visible(OWNER)).toEqual({ keys: ['alpha'], answerKeys: ['alpha'], answerIds: ['a1'], a1: { keys: ['alpha'], hits: ['alpha'] }, a2: 404, threadHits: ['alpha'] });
  });
  it('someone-else には、自分のキー(beta)だけが見える。nekoserver のキー(alpha)は、どの経路にも出ない・強調に使われない', async () => {
    const { visible } = setup();
    expect(await visible(OTHER)).toEqual({ keys: ['beta'], answerKeys: ['beta'], answerIds: ['a2'], a1: 404, a2: { keys: ['beta'], hits: ['beta'] }, threadHits: ['beta'] });
  });
  it('記録のないユーザーには、どの経路にも、何も出ない(強調も無い)', async () => {
    const { visible } = setup();
    expect(await visible(NOBODY)).toEqual({ keys: [], answerKeys: [], answerIds: [], a1: 404, a2: 404, threadHits: [] });
  });
});

describe('既存のキーをすべて nekoserver の所有にしたあと(0198)', () => {
  it('nekoserver には、すべてのキーが見える。ほかのユーザーには、どの経路にも、何も見えない', async () => {
    const { sqlite, visible } = setup();
    sqlite.exec(SQL);
    const owner = await visible(OWNER);
    expect(owner.keys).toEqual(['alpha', 'beta']);
    expect(owner.answerKeys).toEqual(['alpha', 'beta']);
    expect(owner.answerIds).toEqual(['a1', 'a2']);
    expect(owner.a1).toEqual({ keys: ['alpha'], hits: ['alpha'] });
    expect(owner.a2).toEqual({ keys: ['beta'], hits: ['beta'] });
    expect(owner.threadHits).toEqual(['alpha', 'beta']);
    expect(await visible(OTHER)).toEqual({ keys: [], answerKeys: [], answerIds: [], a1: 404, a2: 404, threadHits: [] });
    expect(await visible(NOBODY)).toEqual({ keys: [], answerKeys: [], answerIds: [], a1: 404, a2: 404, threadHits: [] });
  });
  it('流したあとに、ほかのユーザーが新しく検索したキーは、そのユーザーの所有になり、nekoserver には出ない(今後のキーの所有は、検索した本人のまま)', async () => {
    const { sqlite, visible } = setup();
    sqlite.exec(SQL);
    sqlite.prepare("INSERT INTO muse_search_key_log (user_id, search_key, ai_chat_count, tree_view_count, searched_at) VALUES (?, 'gamma', 1, NULL, '2026-11-20T00:00:00Z')").run(OTHER);
    expect((await visible(OTHER)).keys).toEqual(['gamma']);
    expect((await visible(OWNER)).keys).toEqual(['alpha', 'beta']);
  });
});
