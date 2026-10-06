import { describe, expect, it, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { getMarkdownParserScript } from './utils/markdownRenderer';

describe('/neko askgk codex_prompt の応答ログ', () => {
  it.each([
    { threadId: '', saveFails: false },
    { threadId: 'a'.repeat(32), saveFails: false },
    { threadId: 'a'.repeat(32), saveFails: true },
    { threadId: '', saveFails: true },
  ])('replyの保存: threadId=$threadId, saveFails=$saveFails', async ({ threadId, saveFails }) => {
    const reply = '## 回答\n\n1行目\n2行目\n\n- 項目';
    const message = '/neko askgk codex_prompt="◯  詳しく\n説明してください"';
    const inserts: unknown[][] = [];
    const DB = {
      prepare(sql: string) {
        return {
          all: async () => ({ results: [] }),
          bind(...args: unknown[]) {
            return {
              first: async () => sql.includes('user_sessions') ? { revoked_at: null } : { found: 1 },
              run: async () => {
                if (sql.startsWith('INSERT INTO ai_chat_shares')) {
                  if (saveFails) throw new Error('DB write failed');
                  inserts.push(args);
                }
                return { success: true };
              },
            };
          },
        };
      },
    };
    const RUST_WORKER = {
      fetch: vi.fn(async (_input: unknown, init: RequestInit) => {
        const sent = JSON.parse(String(init.body));
        expect(JSON.parse(sent.body).message).toBe(message.replace('/neko askgk ', ''));
        return new Response(JSON.stringify({
          ok: true, status: 200,
          body: JSON.stringify({ reply, status: 'healthy', debug: '保存しない情報' }),
        }));
      }),
    };
    const JWT_SECRET = 'askgk-test-secret';
    const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
    const response = await app.request('/api/aichat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, source: 'textbox', threadId }),
    }, { JWT_SECRET, DB, RUST_WORKER });

    if (saveFails) {
      if (threadId) {
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: '追加質問をスレッドへ保存できませんでした: DB write failed' });
      } else {
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ response: reply, usedModel: 'codex', saveError: 'DB write failed' });
      }
      expect(inserts).toHaveLength(0);
      return;
    }
    expect(response.status).toBe(200);
    const body = await response.json() as { response: string; shareId: string; threadId: string; usedModel: string };
    expect(body.response).toBe(reply);
    expect(body.usedModel).toBe('codex');
    expect(body.threadId).toMatch(/^[0-9a-f]{32}$/);
    if (threadId) expect(body.threadId).toBe(threadId);
    expect(inserts).toHaveLength(1);
    expect(inserts[0][0]).toBe(body.shareId);
    expect(inserts[0][3]).toBe(message);
    expect(inserts[0][1]).toBe('test-user');
    expect(inserts[0][7]).toMatch(/^[0-9a-f]{64}$/);
    expect(inserts[0][8]).toMatch(/^[0-9a-f]{64}$/);
    expect(inserts[0][11]).toBeGreaterThan(0);
    expect(inserts[0][13]).toBeNull();
    expect(inserts[0][4]).toBe(reply);
    expect(inserts[0][5]).toBe('codex');
    expect(inserts[0][12]).toBe('textbox');
    expect(inserts[0][14]).toBe(body.threadId);

    const script = getMarkdownParserScript();
    const parseMd = new Function(script + '\nreturn parseMd;')();
    const html = parseMd(body.response);
    expect(html).toContain('<h2>回答</h2>');
    expect(html).toContain('1行目<br>2行目');
    expect(html).toContain('<li>項目</li>');
  });
  it.each(['invalid', 'b'.repeat(32)])('無効または所有していないスレッドには保存しない: %s', async (threadId) => {
    const run = vi.fn();
    const DB = { prepare: (sql: string) => ({ bind: (...args: unknown[]) => ({
      first: async () => {
        if (sql.includes('user_sessions')) return { revoked_at: null };
        expect(args).toEqual(['test-user', threadId]);
        expect(sql).toContain('deleted_at IS NULL');
        return null;
      },
      run,
    }) }) };
    const JWT_SECRET = 'askgk-test-secret';
    const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
    const response = await app.request('/api/aichat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '/neko askgk codex_prompt="質問"', threadId }),
    }, { JWT_SECRET, DB, RUST_WORKER: { fetch: async () => new Response(JSON.stringify({ ok: true, status: 200, body: JSON.stringify({ reply: '回答' }) })) } });
    expect(response.status).toBe(threadId === 'invalid' ? 400 : 404);
    expect(run).not.toHaveBeenCalled();
  });

});
