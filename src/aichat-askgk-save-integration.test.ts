import { describe, expect, it, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { getMarkdownParserScript } from './utils/markdownRenderer';

describe('/neko askgk codex_prompt の応答ログ', () => {
  it('JSONのreplyだけを改行付きMarkdownとして返し、通常の回答ログに保存する', async () => {
    const reply = '## 回答\n\n1行目\n2行目\n\n- 項目';
    const inserts: unknown[][] = [];
    const DB = {
      prepare(sql: string) {
        return {
          all: async () => ({ results: [] }),
          bind(...args: unknown[]) {
            return {
              first: async () => ({ revoked_at: null }),
              run: async () => {
                if (sql.startsWith('INSERT INTO ai_chat_shares')) inserts.push(args);
                return { success: true };
              },
            };
          },
        };
      },
    };
    const RUST_WORKER = {
      fetch: vi.fn(async () => new Response(JSON.stringify({
        ok: true, status: 200,
        body: JSON.stringify({ reply, status: 'healthy', debug: '保存しない情報' }),
      }))),
    };
    const JWT_SECRET = 'askgk-test-secret';
    const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
    const response = await app.request('/api/aichat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '/neko askgk codex_prompt', source: 'textbox' }),
    }, { JWT_SECRET, DB, RUST_WORKER });

    expect(response.status).toBe(200);
    const body = await response.json() as { response: string; shareId: string; usedModel: string };
    expect(body.response).toBe(reply);
    expect(body.usedModel).toBe('codex');
    expect(inserts).toHaveLength(1);
    expect(inserts[0][0]).toBe(body.shareId);
    expect(inserts[0][3]).toBe('/neko askgk codex_prompt');
    expect(inserts[0][4]).toBe(reply);
    expect(inserts[0][5]).toBe('codex');
    expect(inserts[0][12]).toBe('textbox');
    expect(inserts[0][13]).toBeNull();

    const script = getMarkdownParserScript();
    const parseMd = new Function(script + '\nreturn parseMd;')();
    const html = parseMd(body.response);
    expect(html).toContain('<h2>回答</h2>');
    expect(html).toContain('1行目<br>2行目');
    expect(html).toContain('<li>項目</li>');
  });
});
