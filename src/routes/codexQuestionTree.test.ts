import { describe, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { JSDOM } from 'jsdom';
vi.mock('../middleware/auth', () => ({ authMiddleware: async (c: any, next: any) => {
  if (!c.req.header('Authorization')) return c.json({ error: 'Unauthorized' }, 401);
  c.set('user', { sub: 'alice' }); await next();
} }));
import { codexQuestionTreeRoutes } from './codexQuestionTree';
import { getCodexQuestionTreePage } from '../views/codexQuestionTree';
function logId(id: number) { return 'abcdef' + (1000 - id).toString(16).padStart(26, '0'); }
function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec('CREATE TABLE ai_chat_shares(id TEXT PRIMARY KEY, user_id TEXT, model TEXT, deleted_at TEXT, question TEXT, answer TEXT, thread_id TEXT, created_at TEXT)');
  sql.exec('CREATE TABLE aichat_search_log(user_id TEXT, keyword TEXT, share_id TEXT); CREATE TABLE aichat_keyword_categories(id INTEGER, user_id TEXT, name TEXT, color TEXT); CREATE TABLE aichat_keyword_category_map(user_id TEXT, keyword TEXT, category_id INTEGER)');
  const insert = sql.prepare('INSERT INTO ai_chat_shares VALUES(?,?,?,?,?,?,?,?)');
  for (let id = 1; id <= 103; id++) insert.run(logId(id), 'alice', 'codex', null, '/neko askgk codex_prompt="質問' + id + '"', '回答' + id, 'thread-1', new Date(1700000000000 + Math.max(id, 4) * 1000).toISOString());
  insert.run(logId(104), 'bob', 'codex', null, 'private', 'secret', null, '2026-10-07');
  insert.run(logId(105), 'alice', 'other', null, 'other', 'answer', null, '2026-10-07');
  insert.run(logId(106), 'alice', 'codex', 'deleted', 'deleted', 'answer', null, '2026-10-07');
  const DB = { prepare(query: string) { return { bind(...values: any[]) { return {
    async all() { return { results: sql.prepare(query).all(...values) }; },
    async first() { return sql.prepare(query).get(...values); }
  }; } }; } };
  return { sql, request: (url: string, auth = true) => codexQuestionTreeRoutes.request(url, { headers: auth ? { Authorization: 'test' } : {} }, { DB }) };
}
describe('Codex question tree', () => {
  it('retrieves answers using the original hexadecimal text ID', async () => {
    const { sql, request } = fixture();
    try {
      const response = await request('/api/mcp-sample/codex-questions/' + logId(103));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ id: logId(103), answer: '回答103' });
    } finally { sql.close(); }
  });
  it('paginates Codex logs without exposing other users, deleted rows or other models', async () => {
    const { sql, request } = fixture();
    const first = await request('/api/mcp-sample/codex-questions');
    expect(first.headers.get('Cache-Control')).toBe('no-store');
    const page: any = await first.json();
    expect(page.items).toHaveLength(100); expect(page.items[0].question).toBe('質問103');
    const next: any = await (await request('/api/mcp-sample/codex-questions?before=' + encodeURIComponent(page.nextCursor))).json();
    expect(next.items).toHaveLength(3); expect(next.nextCursor).toBeNull();
    expect(new Set([...page.items, ...next.items].map(row => row.id)).size).toBe(103);
    for (const id of [104, 105, 106]) expect((await request('/api/mcp-sample/codex-questions/' + logId(id))).status).toBe(404);
    const row: any = await (await request('/api/mcp-sample/codex-questions/' + logId(103))).json();
    expect(row.answer).toBe('回答103'); expect(row.question).toBe('質問103'); sql.close();
  });
  it('flags contained registered keywords and counts occurrences across owned live answers', async () => {
    const { sql, request } = fixture();
    sql.exec(`INSERT INTO ai_chat_shares VALUES
      ('keyword-answer','alice','codex',NULL,'キーワード質問','MCP MCP SQLite','thread-2','2026-10-08'),
      ('other-model','alice','other',NULL,'別モデル','MCP SQLite SQLite',NULL,'2026-10-08'),
      ('private-keywords','bob','codex',NULL,'秘密','MCP MCP MCP',NULL,'2026-10-08'),
      ('deleted-keywords','alice','codex','deleted','削除','MCP MCP MCP',NULL,'2026-10-08');
      INSERT INTO aichat_search_log VALUES ('alice','MCP','keyword-answer'),('alice','MCP','other-model'),('alice','SQLite','keyword-answer'),('alice','不在','keyword-answer'),('bob','回答','private-keywords');
      INSERT INTO aichat_keyword_categories VALUES (1,'alice','開発','#336699'),(2,'alice','データベース','#990000'),(3,'bob','秘密分類','#000000'),(4,'alice','無関係','#000000');
      INSERT INTO aichat_keyword_category_map VALUES ('alice','MCP',1),('alice','SQLite',1),('alice','SQLite',2),('bob','MCP',3),('alice','MCP',3),('alice','不在',4);`);
    const list: any = await (await request('/api/mcp-sample/codex-questions')).json();
    expect(list.items.find((row: any) => row.id === 'keyword-answer').has_keywords).toBe(true);
    expect(list.items.find((row: any) => row.id === logId(103)).has_keywords).toBe(false);
    const data: any = await (await request('/api/mcp-sample/codex-questions/keyword-answer/keywords')).json();
    expect(data.keywords).toEqual([{ keyword: 'MCP', count: 3, categoryIds: [1] }, { keyword: 'SQLite', count: 3, categoryIds: [1, 2] }]
    );
    expect(data.categories).toEqual([{ id: 1, name: '開発', color: '#336699', count: 2 }, { id: 2, name: 'データベース', color: '#990000', count: 1 }]);
    expect((await request('/api/mcp-sample/codex-questions/private-keywords/keywords')).status).toBe(404);
    expect((await request('/api/mcp-sample/codex-questions/deleted-keywords/keywords')).status).toBe(404);
    sql.close();
  });
  it('requires authentication and validates pagination', async () => {
    const { sql, request } = fixture();
    expect((await request('/mcp-codex-tree', false)).status).toBe(401);
    expect((await request('/api/mcp-sample/codex-questions', false)).status).toBe(401);
    expect((await request('/api/mcp-sample/codex-questions?before=-1')).status).toBe(400); sql.close();
  });
  it('opens Markdown answers safely without repeating the question above them', async () => {
    const dom = new JSDOM(getCodexQuestionTreePage(), { runScripts: 'dangerously', url: 'https://example.test', beforeParse(window) {
      window.fetch = vi.fn(async (url: any) => ({ ok: true, json: async () => String(url).endsWith('/7') ? { answer: '# 回答見出し\n\n- **項目**\n\n```js\nconst x = 1;\n```\n\n<script>bad()</script>' } : { items: [{ id: 7, question: '<img onerror=bad()>\n全文', created_at: '2026-10-07', thread_id: 'thread-1' }], nextCursor: null } })) as any;
    } });
    await vi.waitFor(() => expect(dom.window.document.querySelectorAll('details')).toHaveLength(3));
    const group = dom.window.document.querySelectorAll('details')[1];
    expect(group.querySelector('summary')?.textContent).toContain('全文');
    expect(group.querySelector('summary')?.textContent).not.toContain('thread-1');
    const question = dom.window.document.querySelectorAll('details')[2];
    question.open = true; question.dispatchEvent(new dom.window.Event('toggle'));
    await vi.waitFor(() => expect(question.querySelector('.markdown-body h1')?.textContent).toBe('回答見出し'));
    expect(question.querySelector('.question-content')?.firstElementChild?.textContent).toBe('Codexの回答');
    expect(question.querySelector('.question-content > pre')).toBeNull();
    expect(question.querySelector('.markdown-body li strong')?.textContent).toBe('項目');
    expect(question.querySelector('.markdown-body pre code')?.textContent).toBe('const x = 1;');
    expect(question.querySelector('.markdown-body')?.textContent).toContain('<script>bad()</script>');
    expect(question.querySelector('script')).toBeNull();
    expect(question.querySelector('img')).toBeNull(); dom.window.close();
  });
});
