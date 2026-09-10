/**
 * POST /api/aichat/permission-external, POST /api/aichat/query-external のテスト
 *
 * 対象: dynamicnekoのAI問い合わせウィジェットがService Binding経由で呼ぶ
 * 2本の外部API。Bearer secret(AICHAT_EXTERNAL_SECRET)で認証した上、さらに
 * D1のdynamicneko_aichat_allowed_usersに登録されたメールアドレスかどうかを
 * 判定する(許可されたユーザーにのみAI問い合わせを許可する要件)。
 *
 * 故障シナリオ:
 *   (1) Bearer secretが一致しないリクエストが素通りしてしまう
 *   (2) permission-externalで未許可メールアドレスがallowed:trueと誤判定される
 *   (3) query-externalで未許可メールアドレスがAIバインディング呼び出しまで
 *       到達してしまう(無駄なAI課金・クライアント側チェック省略への抜け道)
 *   (4) DB未設定・クエリ失敗時にフェイルオープン(誤ってallowed扱い)してしまう
 */
import { describe, it, expect, vi } from 'vitest';
import app from './index';

const SECRET = 'test-aichat-external-secret';

function createMockDb(allowedEmails: string[]) {
  const first = vi.fn().mockImplementation((..._args: unknown[]) => Promise.resolve(null));
  const bind = vi.fn().mockImplementation((email: string) => ({
    first: vi.fn().mockResolvedValue(allowedEmails.includes(email) ? { 1: 1 } : null),
  }));
  return {
    prepare: vi.fn().mockReturnValue({ bind, first }),
  } as unknown as D1Database;
}

describe('POST /api/aichat/permission-external', () => {
  it('Bearer secretが一致しない場合は401', async () => {
    const db = createMockDb(['ok@example.com']);
    const res = await app.request(
      '/api/aichat/permission-external',
      { method: 'POST', headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db }
    );
    expect(res.status).toBe(401);
  });

  it('許可リストに登録されたメールアドレスはallowed:trueを返す', async () => {
    const db = createMockDb(['ok@example.com']);
    const res = await app.request(
      '/api/aichat/permission-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { allowed: boolean };
    expect(body.allowed).toBe(true);
  });

  it('許可リストに無いメールアドレスはallowed:falseを返す', async () => {
    const db = createMockDb(['ok@example.com']);
    const res = await app.request(
      '/api/aichat/permission-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ng@example.com' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { allowed: boolean };
    expect(body.allowed).toBe(false);
  });

  it('DB未設定時はフェイルクローズでallowed:falseを503で返す', async () => {
    const res = await app.request(
      '/api/aichat/permission-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET }
    );
    expect(res.status).toBe(503);
    const body = await res.json() as { allowed: boolean };
    expect(body.allowed).toBe(false);
  });
});

describe('POST /api/aichat/query-external', () => {
  it('Bearer secretが一致しない場合は401', async () => {
    const db = createMockDb(['ok@example.com']);
    const res = await app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', question: 'hi' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db }
    );
    expect(res.status).toBe(401);
  });

  it('未許可メールアドレスは403で拒否され、AIバインディングは呼ばれない', async () => {
    const db = createMockDb(['ok@example.com']);
    const aiRun = vi.fn();
    const res = await app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ng@example.com', question: 'hi' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db, AI: { run: aiRun } }
    );
    expect(res.status).toBe(403);
    expect(aiRun).not.toHaveBeenCalled();
    const body = await res.json() as { error: string };
    expect(body.error).toContain('許可');
  });

  it('questionが空の場合は400', async () => {
    const db = createMockDb(['ok@example.com']);
    const res = await app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', question: '  ' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db }
    );
    expect(res.status).toBe(400);
  });

  it('許可済みメールアドレスはAIバインディングを呼び出しanswerを返す', async () => {
    const db = createMockDb(['ok@example.com']);
    const aiRun = vi.fn().mockResolvedValue({ response: 'こんにちは' });
    const res = await app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', question: 'hi' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db, AI: { run: aiRun } }
    );
    expect(res.status).toBe(200);
    expect(aiRun).toHaveBeenCalled();
    const body = await res.json() as { answer: string };
    expect(body.answer).toBe('こんにちは');
  });

  it('DB未設定時はフェイルクローズで503を返す(AIバインディングは呼ばれない)', async () => {
    const aiRun = vi.fn();
    const res = await app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', question: 'hi' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, AI: { run: aiRun } }
    );
    expect(res.status).toBe(503);
    expect(aiRun).not.toHaveBeenCalled();
  });

  it('modelを指定しない場合はデフォルト(Gemma-4)でAI.run()を呼ぶ', async () => {
    const db = createMockDb(['ok@example.com']);
    const aiRun = vi.fn().mockResolvedValue({ response: 'こんにちは' });
    await app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', question: 'hi' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db, AI: { run: aiRun } }
    );
    expect(aiRun.mock.calls[0][0]).toBe('@cf/google/gemma-4-26b-a4b-it');
  });

  it('許可リストにあるmodel(Qwen3.8)を指定した場合はそのモデルでAI.run()を呼ぶ', async () => {
    const db = createMockDb(['ok@example.com']);
    const aiRun = vi.fn().mockResolvedValue({ response: 'こんにちは' });
    await app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', question: 'hi', model: '@cf/qwen/qwen3.8-27b' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db, AI: { run: aiRun } }
    );
    expect(aiRun.mock.calls[0][0]).toBe('@cf/qwen/qwen3.8-27b');
  });

  it('許可リストに無いmodel(改ざん)を指定した場合はデフォルト(Gemma-4)へフォールバックする', async () => {
    const db = createMockDb(['ok@example.com']);
    const aiRun = vi.fn().mockResolvedValue({ response: 'こんにちは' });
    await app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', question: 'hi', model: '@cf/meta/llama-3.1-8b-instruct' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db, AI: { run: aiRun } }
    );
    expect(aiRun.mock.calls[0][0]).toBe('@cf/google/gemma-4-26b-a4b-it');
  });
});
