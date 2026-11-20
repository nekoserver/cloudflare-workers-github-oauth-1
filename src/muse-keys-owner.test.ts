// 既存のキーワードを、すべて nekoserver の所有にするSQL(2026-11-19、ユーザー指定「muse-searchの今あるキーワードをすべてnekoserverの所有となるように」)。
// 対象は、検索キーの記録(muse_search_key_log)と、回答ごとの記録(muse_search_answer_log)。所有は、user_id 列(ログインユーザー=GitHubのログイン名)。
// 仮説:
//   1. 流したあと、2つの表のすべての行の user_id が nekoserver になる。行数は変わらない。キー・回数・日時など、user_id 以外の列は変わらない。
//   2. 2回流しても、結果は同じ(冪等)。すでに nekoserver の行は、触らない。
//   3. ほかの表(ハンドルネームの表・AIチャットの履歴)は、変えない。
//   4. D1のコンソールへ貼れるよう、コメントを入れない。1文ずつ貼れる。
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createMuseSearchKeysSqlite } from './utils/museSearchKeys.testdb';

const FILE = 'migrations/0198_assign_muse_keys_to_nekoserver.sql';
const statements = (sql: string) => sql.split(';').map((x) => x.trim()).filter(Boolean);

function seed() {
  const sqlite = createMuseSearchKeysSqlite();
  const key = (user: string, k: string, ai: number, tree: number | null, at: string) => sqlite.prepare('INSERT INTO muse_search_key_log (user_id, search_key, ai_chat_count, tree_view_count, searched_at) VALUES (?, ?, ?, ?, ?)').run(user, k, ai, tree, at);
  const answer = (user: string, k: string, id: string) => sqlite.prepare("INSERT INTO muse_search_answer_log (user_id, search_key, answer_id, chat_id, thread_id, occurrences, preview, answer_created_at, searched_at) VALUES (?, ?, ?, 'c1', 't1', 2, 'p', 100, '2026-11-19T00:00:00Z')").run(user, k, id);
  key('nekoserver', 'alpha', 3, 1, '2026-11-19T01:00:00Z');
  key('someone-else', 'beta', 5, null, '2026-11-19T02:00:00Z');
  key('another', 'alpha', 1, 2, '2026-11-19T03:00:00Z');
  answer('nekoserver', 'alpha', 'a1');
  answer('someone-else', 'beta', 'a2');
  answer('another', 'alpha', 'a3');
  sqlite.prepare("INSERT INTO muse_user_handles (user_id, user_name, handle_name, handle_key, created_at, updated_at) VALUES ('someone-else', 'someone-else', 'Neko', 'neko', 't', 't')").run();
  return sqlite;
}
const rows = (sqlite: ReturnType<typeof seed>, sql: string) => (sqlite.prepare(sql).all() as Record<string, unknown>[]).map((r) => ({ ...r }));
const KEYS = 'SELECT id, search_key, ai_chat_count, tree_view_count, searched_at FROM muse_search_key_log ORDER BY id';
const ANSWERS = 'SELECT id, search_key, answer_id, chat_id, thread_id, occurrences, preview, answer_created_at, searched_at FROM muse_search_answer_log ORDER BY id';
const owners = (sqlite: ReturnType<typeof seed>, table: string) => rows(sqlite, `SELECT DISTINCT user_id FROM ${table}`).map((r) => r.user_id);

describe(FILE, () => {
  const sql = readFileSync(FILE, 'utf8');
  it('コメントを入れない。UPDATE が2文(検索キーの記録・回答ごとの記録)で、どちらも user_id だけを書き換える', () => {
    expect(sql).not.toContain('--');
    const list = statements(sql);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatch(/^UPDATE muse_search_key_log SET user_id = 'nekoserver' WHERE user_id <> 'nekoserver'$/);
    expect(list[1]).toMatch(/^UPDATE muse_search_answer_log SET user_id = 'nekoserver' WHERE user_id <> 'nekoserver'$/);
  });
  it('流すと、2つの表のすべての行が nekoserver の所有になる。行数・キー・回数・日時は変わらない', () => {
    const sqlite = seed();
    const keysBefore = rows(sqlite, KEYS);
    const answersBefore = rows(sqlite, ANSWERS);
    expect(owners(sqlite, 'muse_search_key_log').sort()).toEqual(['another', 'nekoserver', 'someone-else']);
    sqlite.exec(sql);
    expect(owners(sqlite, 'muse_search_key_log')).toEqual(['nekoserver']);
    expect(owners(sqlite, 'muse_search_answer_log')).toEqual(['nekoserver']);
    expect(rows(sqlite, KEYS)).toEqual(keysBefore);
    expect(rows(sqlite, ANSWERS)).toEqual(answersBefore);
    expect(rows(sqlite, 'SELECT COUNT(*) AS n FROM muse_search_key_log')).toEqual([{ n: 3 }]);
  });
  it('2文は、1文ずつ流しても同じ(D1のコンソールへ、1文ずつ貼れる)。2回流しても、結果は同じ(冪等)', () => {
    const sqlite = seed();
    for (const one of statements(sql)) sqlite.exec(one + ';');
    const once = { keys: rows(sqlite, 'SELECT * FROM muse_search_key_log ORDER BY id'), answers: rows(sqlite, 'SELECT * FROM muse_search_answer_log ORDER BY id') };
    sqlite.exec(sql);
    expect({ keys: rows(sqlite, 'SELECT * FROM muse_search_key_log ORDER BY id'), answers: rows(sqlite, 'SELECT * FROM muse_search_answer_log ORDER BY id') }).toEqual(once);
    const changed = sqlite.prepare("UPDATE muse_search_key_log SET user_id = 'nekoserver' WHERE user_id <> 'nekoserver'").run();
    expect(Number(changed.changes)).toBe(0);
  });
  it('ほかの表は変えない(ハンドルネームの表は、他のユーザーの行のまま)', () => {
    const sqlite = seed();
    sqlite.exec(sql);
    expect(rows(sqlite, 'SELECT user_id, handle_name FROM muse_user_handles')).toEqual([{ user_id: 'someone-else', handle_name: 'Neko' }]);
  });
});
