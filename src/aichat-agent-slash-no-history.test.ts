import { describe, expect, it } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { isAskgkSlashPrompt } from './utils/codexAskgkQuestion';

describe('エージェントのスラッシュコマンドは通常のAI応答ログに保存しない', () => {
  it.each(['codex_prompt="/status"', 'claude_prompt="/usage"', 'nemotron_prompt="/help"', 'codex_prmpt="/usage"', 'codex_prompt=“ /model ”', 'codex_prompt="%2Fstatus"', 'codex_prompt=/help', 'codex_prompt="./usage"'])('制御コマンドを判定: %s', (input) => {
    expect(isAskgkSlashPrompt(input)).toBe(true);
  });
  it.each(['codex_prompt="普通の質問"', 'codex_prompt="/statusについて説明して"', 'codex_status', 'claude_prompt="URL https://example.com/"'])('通常入力を保存対象に維持: %s', (input) => {
    // スラッシュで始まる文章はコマンド扱い。途中のスラッシュは対象外。
    expect(isAskgkSlashPrompt(input)).toBe(input.includes('"/status'));
  });
  it.each([
    { message: '/neko askgk codex_prompt="/status"' },
    { message: '/neko askgk claude_prompt="/usage"' },
    { message: '/neko askgk nemotron_prompt="/help"' },
    { message: '/neko askgk codex_prmpt="/usage"' },
    { message: '/usage', model: 'codex' },
    { message: '/status', model: 'claude' },
  ])('返信を維持し保存・トークン推定・色登録を行わない: %j', async (request) => {
    const writes: string[] = [];
    const DB = { prepare: (sql: string) => ({
      all: async () => ({ results: [] }),
      bind: (..._args: unknown[]) => ({
        first: async () => sql.includes('user_sessions') ? { revoked_at: null } : null,
        all: async () => ({ results: [] }),
        run: async () => { writes.push(sql); return { success: true }; },
      }),
    }) };
    const token = await createJWT({ sub: 'slash-user', name: 'Slash User' }, 'test-secret');
    const response = await app.request('/api/aichat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      // 保存しない操作では古いスレッドIDによる保存用の検証も不要。
      body: JSON.stringify({ ...request, threadId: 'invalid-old-thread' }),
    }, { JWT_SECRET: 'test-secret', DB, RUST_WORKER: { fetch: async () => new Response(JSON.stringify({ ok: true, status: 200, body: JSON.stringify({ reply: request.message === '/neko askgk codex_prompt="/status"' ? 'codex 5時間枠: 残り 86%（使用 14%）、リセット 2099-01-01 00:00:36 UTC' : 'コマンド実行結果' }) })) } });
    const body = await response.json() as Record<string, unknown>;
    expect(response.status).toBe(200);
    if (request.message === '/neko askgk codex_prompt="/status"') {
      expect(body.response).toBe('2099-01-01 09:00:36');
      expect(body.responseAlign).toBe('center');
    } else expect(body.response).toBe('コマンド実行結果');
    expect(body.shareId).toBeUndefined();
    expect(body.usage).toBeUndefined();
    expect(writes.some(sql => /ai_chat_shares|aichat_model_colors/.test(sql))).toBe(false);
  });
});
