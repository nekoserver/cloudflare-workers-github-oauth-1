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
  it('requires authentication and validates pagination', async () => {
    const { sql, request } = fixture();
    expect((await request('/mcp-codex-tree', false)).status).toBe(401);
    expect((await request('/api/mcp-sample/codex-questions', false)).status).toBe(401);
    expect((await request('/api/mcp-sample/codex-questions?before=-1')).status).toBe(400); sql.close();
  });
  it('opens full questions and answers safely from folder nodes', async () => {
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
    expect(question.querySelector('pre')?.textContent).toBe('<img onerror=bad()>\n全文');
    expect(question.querySelector('.markdown-body li strong')?.textContent).toBe('項目');
    expect(question.querySelector('.markdown-body pre code')?.textContent).toBe('const x = 1;');
    expect(question.querySelector('.markdown-body')?.textContent).toContain('<script>bad()</script>');
    expect(question.querySelector('script')).toBeNull();
    expect(question.querySelector('img')).toBeNull(); dom.window.close();
  });
});
