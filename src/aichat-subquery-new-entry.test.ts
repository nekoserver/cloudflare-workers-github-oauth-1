import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';

const databases: DatabaseSync[] = [];
afterEach(() => { databases.splice(0).forEach(db => db.close()); });
function wrapDb(db: DatabaseSync) {
  return { prepare: (sql: string) => {
    if (sql.includes('user_sessions')) return { bind: () => ({ first: async () => ({ revoked_at: null }) }) };
    const statement = db.prepare(sql);
    const chain = (args: unknown[]) => ({
      first: async () => statement.get(...args as never[]) ?? null,
      all: async () => ({ results: statement.all(...args as never[]) }),
      run: async () => { const result = statement.run(...args as never[]); return { meta: { changes: Number(result.changes) } }; },
      bind: (...values: unknown[]) => chain(values),
    });
    return chain([]);
  } };
}

describe('新規サブクエリの保存から読み出し', () => {
  it('利用済み100件がある状態でも新規追加を一覧・重複チェック用に読み出せる', async () => {
    const db = new DatabaseSync(':memory:'); databases.push(db);
    db.exec(`CREATE TABLE aichat_subqueries (id INTEGER PRIMARY KEY AUTOINCREMENT, query TEXT UNIQUE);
      CREATE TABLE aichat_share_subquery_links (id INTEGER PRIMARY KEY, subquery_id INTEGER, question TEXT);
      CREATE TABLE ai_chat_shares (id TEXT PRIMARY KEY, question TEXT);
      CREATE TABLE aichat_search_history (share_id TEXT, keyword TEXT, deleted_at TEXT);`);
    for (let index = 1; index <= 100; index++) {
      db.prepare('INSERT INTO aichat_subqueries (query) VALUES (?)').run('利用済み' + index);
      db.prepare('INSERT INTO aichat_share_subquery_links (id, subquery_id, question) VALUES (?, ?, ?)').run(index, index, '質問' + index);
    }
    const JWT_SECRET = 'subquery-test';
    const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
    const env = { DB: wrapDb(db), JWT_SECRET };
    const query = '新規追加した質問文';
    const added = await app.request('/api/aichat/subqueries', { method: 'POST', headers, body: JSON.stringify({ query }) }, env);
    expect(added.status).toBe(200);
    const saved = await added.json() as { item: { id: number; query: string }; inserted: boolean };
    expect(saved.inserted).toBe(true);
    const listed = await app.request('/api/aichat/subqueries', { headers }, env);
    expect(listed.headers.get('Cache-Control')).toBe('no-store');
    const result = await listed.json() as { items: Array<{ id: number; query: string; link_count: number; keywords: unknown[] }> };
    expect(result.items).toHaveLength(101);
    expect(result.items).toContainEqual({ ...saved.item, link_count: 0, keywords: [] });
    const duplicate = await app.request('/api/aichat/subqueries', { method: 'POST', headers, body: JSON.stringify({ query }) }, env);
    expect(await duplicate.json()).toMatchObject({ inserted: false, item: saved.item });
  });
});
