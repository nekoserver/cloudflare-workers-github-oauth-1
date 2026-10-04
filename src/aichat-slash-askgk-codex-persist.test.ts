import { describe, expect, it } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

// 対象: POST /api/aichat の /neko askgk codex_prompt="..." 専用経路。
// codexの応答を通常のAI応答と同じ経路(ai_chat_shares保存・model='codex'・
// usage/shareIdの付与)に乗せ、session idをcodex_session_idへ保存する。
//
// 故障シナリオ:
//   (1) バナー・session id行がそのまま画面に残ってしまう
//   (2) session idが保存されない、または画面に漏れて表示されてしまう
//   (3) usedModelが'local/neko'のままで、クライアント側がisLocalCommand扱いし
//       ✂️/📔ボタン等が表示されない
//   (4) shareId/usageが無く、✂️/📔ボタンの表示条件を満たせない
//   (5) aichat_model_colorsへのcodex色登録が行われない

function rustWorkerFetcher(reply: string) {
  return {
    fetch: async () =>
      new Response(
        JSON.stringify({ ok: true, status: 200, body: JSON.stringify({ reply }) }),
        { status: 200 }
      ),
  };
}

describe('POST /api/aichat: /neko askgk codex_prompt="..."', () => {
  it('バナー・session idを除去し、model=codex・usage・shareIdを返してai_chat_sharesへ保存する', async () => {
    const reply = [
      'workdir: /home/user/repo',
      'model: gpt-5-codex',
      'reasoning effort: high',
      'session id: codex-abc-123',
      '実際の回答本文',
    ].join('\n');

    const inserts: { sql: string; values: unknown[] }[] = [];
    const db = {
      prepare: (sql: string) => ({
        all: () => Promise.resolve({ results: [] }),
        bind: (...values: unknown[]) => ({
          first: () => Promise.resolve(sql.includes('user_sessions') ? { revoked_at: null } : null),
          all: () => Promise.resolve({ results: [] }),
          run: () => {
            inserts.push({ sql, values });
            return Promise.resolve({ success: true });
          },
        }),
      }),
    };

    const token = await createJWT({ sub: 'codex-user', name: 'Codex User' }, 'test-secret');
    const response = await app.request('/api/aichat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '/neko askgk codex_prompt="テスト質問"' }),
    }, { JWT_SECRET: 'test-secret', DB: db, RUST_WORKER: rustWorkerFetcher(reply) });

    const body = await response.json() as {
      response: string; usedModel: string; usage?: { input_tokens: number; output_tokens: number; total_tokens: number }; shareId?: string;
    };

    expect(response.status).toBe(200);
    expect(body.response).toBe('実際の回答本文');
    expect(body.response).not.toContain('workdir');
    expect(body.response).not.toContain('session id');
    expect(body.usedModel).toBe('codex');
    expect(body.shareId).toBeTruthy();
    expect(body.usage?.total_tokens).toBeGreaterThan(0);

    const shareInsert = inserts.find((i) => i.sql.includes('INSERT INTO ai_chat_shares'));
    expect(shareInsert).toBeDefined();
    // (id, user_id, user_hash, question, answer, model, created_at, conversation_hash,
    //  question_hash, input_tokens, output_tokens, total_tokens, source, codex_session_id)
    expect(shareInsert!.values[4]).toBe('実際の回答本文');
    expect(shareInsert!.values[5]).toBe('codex');
    expect(shareInsert!.values[13]).toBe('codex-abc-123');

    const colorInsert = inserts.find((i) => i.sql.includes('INSERT OR IGNORE INTO aichat_model_colors'));
    expect(colorInsert).toBeDefined();
    expect(colorInsert!.values[0]).toBe('codex');
  });

  it('claude_prompt="..."等(codex以外)は従来通りmodel=local/neko・ai_chat_sharesへは保存しない', async () => {
    const inserts: { sql: string }[] = [];
    const db = {
      prepare: (sql: string) => ({
        bind: () => ({
          first: () => Promise.resolve(sql.includes('user_sessions') ? { revoked_at: null } : null),
          all: () => Promise.resolve({ results: [] }),
          run: () => { inserts.push({ sql }); return Promise.resolve({ success: true }); },
        }),
      }),
    };
    const token = await createJWT({ sub: 'claude-user', name: 'Claude User' }, 'test-secret');
    const response = await app.request('/api/aichat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '/neko askgk claude_prompt="テスト質問"' }),
    }, { JWT_SECRET: 'test-secret', DB: db, RUST_WORKER: rustWorkerFetcher('回答本文') });

    const body = await response.json() as { response: string; usedModel: string };
    expect(body.usedModel).toBe('local/neko');
    expect(body.response).toBe('回答本文');
    expect(inserts.some((i) => i.sql.includes('INSERT INTO ai_chat_shares'))).toBe(false);
  });
});
