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
 *   (5)(セキュリティ) リクエスト本文のloginをそのままuser_idとして信用すると、
 *       Bearer secretと許可済みメールアドレス1件さえ知っていれば、loginを
 *       任意の値に差し替えて他ユーザーのai_chat_sharesへ書き込み・集計参照
 *       できてしまう(PR #1809/#1810で混入した脆弱性)。サーバー側は
 *       リクエスト本文のloginを一切受け取らず、emailに紐づく
 *       dynamicneko_aichat_allowed_users.github_loginだけを信頼すること
 */
import { describe, it, expect, vi } from 'vitest';
import app from './index';

const SECRET = 'test-aichat-external-secret';

/**
 * email -> github_login の許可マップからモックD1を作る。isDynamicnekoAichatAllowed
 * (SELECT 1 ...)とresolveDynamicnekoAllowedLogin(SELECT github_login ...)の
 * 両方のクエリ形状を、実行されるSQL文の内容で判別して返す。
 */
function createMockDb(allowedUsers: Record<string, string>) {
  const prepare = vi.fn().mockImplementation((sql: string) => ({
    bind: vi.fn().mockImplementation((email: string) => ({
      first: vi.fn().mockImplementation(() => {
        const login = allowedUsers[email];
        if (login === undefined) return Promise.resolve(null);
        if (sql.includes('github_login')) return Promise.resolve({ github_login: login });
        return Promise.resolve({ 1: 1 });
      }),
    })),
  }));
  return { prepare } as unknown as D1Database;
}

describe('POST /api/aichat/permission-external', () => {
  it('Bearer secretが一致しない場合は401', async () => {
    const db = createMockDb({ 'ok@example.com': 'nekoserver' });
    const res = await app.request(
      '/api/aichat/permission-external',
      { method: 'POST', headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db }
    );
    expect(res.status).toBe(401);
  });

  it('許可リストに登録されたメールアドレスはallowed:trueを返す', async () => {
    const db = createMockDb({ 'ok@example.com': 'nekoserver' });
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
    const db = createMockDb({ 'ok@example.com': 'nekoserver' });
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

  it('許可リストには登録されているがgithub_login未設定のメールアドレスはallowed:falseを返す(グレーアウト表示にするため。query-external側の500エラーをボタンを押すまで知れない状態にしない)', async () => {
    const db = createMockDb({ 'ok@example.com': '' });
    const res = await app.request(
      '/api/aichat/permission-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { allowed: boolean };
    expect(body.allowed).toBe(false);
  });
});

describe('POST /api/aichat/query-external', () => {
  it('Bearer secretが一致しない場合は401', async () => {
    const db = createMockDb({ 'ok@example.com': 'nekoserver' });
    const res = await app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', question: 'hi' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db }
    );
    expect(res.status).toBe(401);
  });

  it('未許可メールアドレスは403で拒否され、AIバインディングは呼ばれない', async () => {
    const db = createMockDb({ 'ok@example.com': 'nekoserver' });
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
    const db = createMockDb({ 'ok@example.com': 'nekoserver' });
    const res = await app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', question: '  ' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db }
    );
    expect(res.status).toBe(400);
  });

  it('許可済みメールアドレスはAIバインディングを呼び出しanswerを返す', async () => {
    const db = createMockDb({ 'ok@example.com': 'nekoserver' });
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

  it('許可済みだがgithub_login未登録のメールアドレスは500で拒否される(user_idを空文字のまま使ってしまう事故を防ぐ)', async () => {
    const db = createMockDb({ 'ok@example.com': '' });
    const aiRun = vi.fn();
    const res = await app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', question: 'hi' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db, AI: { run: aiRun } }
    );
    expect(res.status).toBe(500);
    expect(aiRun).not.toHaveBeenCalled();
  });

  it('デフォルトモデル(Gemma-4)はmax_tokensとenable_thinking:falseを付けてAI.run()を呼ぶ(既知のthinking mode暴走対策)', async () => {
    const db = createMockDb({ 'ok@example.com': 'nekoserver' });
    const aiRun = vi.fn().mockResolvedValue({ response: 'こんにちは' });
    await app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', question: 'hi' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db, AI: { run: aiRun } }
    );
    const [calledModel, calledParams] = aiRun.mock.calls[0] as [string, { max_tokens?: number; chat_template_kwargs?: { enable_thinking?: boolean } }];
    expect(calledModel).toBe('@cf/google/gemma-4-26b-a4b-it');
    expect(calledParams.max_tokens).toBe(65536);
    expect(calledParams.chat_template_kwargs).toEqual({ enable_thinking: false });
  });

  it('AI.run()がタイムアウト時間内に応答しない場合はハングせず502エラーで返る(スピナーが回り続けるバグの再現テスト)', async () => {
    const db = createMockDb({ 'ok@example.com': 'nekoserver' });
    const aiRun = vi.fn().mockImplementation(() => new Promise(() => { /* 永久に解決しない */ }));
    const resPromise = app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', question: 'hi' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db, AI: { run: aiRun } }
    );
    vi.useFakeTimers();
    try {
      const settled = resPromise.then((res) => ({ settled: true, res }));
      await vi.advanceTimersByTimeAsync(30000);
      const result = await Promise.race([
        settled,
        Promise.resolve({ settled: false as const }),
      ]);
      expect(result.settled).toBe(true);
      if (result.settled) {
        expect(result.res.status).toBe(500);
        const body = await result.res.json() as { error: string };
        expect(body.error).toContain('タイムアウト');
      }
    } finally {
      vi.useRealTimers();
    }
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
    const db = createMockDb({ 'ok@example.com': 'nekoserver' });
    const aiRun = vi.fn().mockResolvedValue({ response: 'こんにちは' });
    await app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', question: 'hi' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db, AI: { run: aiRun } }
    );
    expect(aiRun.mock.calls[0][0]).toBe('@cf/google/gemma-4-26b-a4b-it');
  });

  it('許可リストにあるmodel(Qwen3.8)を指定した場合はそのモデルでAI.run()を呼ぶ', async () => {
    const db = createMockDb({ 'ok@example.com': 'nekoserver' });
    const aiRun = vi.fn().mockResolvedValue({ response: 'こんにちは' });
    await app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', question: 'hi', model: '@cf/qwen/qwen3.8-27b' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db, AI: { run: aiRun } }
    );
    expect(aiRun.mock.calls[0][0]).toBe('@cf/qwen/qwen3.8-27b');
  });

  it('許可リストに無いmodel(改ざん)を指定した場合はデフォルト(Gemma-4)へフォールバックする', async () => {
    const db = createMockDb({ 'ok@example.com': 'nekoserver' });
    const aiRun = vi.fn().mockResolvedValue({ response: 'こんにちは' });
    await app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', question: 'hi', model: '@cf/meta/llama-3.1-8b-instruct' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db, AI: { run: aiRun } }
    );
    expect(aiRun.mock.calls[0][0]).toBe('@cf/google/gemma-4-26b-a4b-it');
  });
});

// ===========================================================
// POST /api/aichat/query-external: /neko aireqst (dynamicnekoから呼び出し可能)
// ===========================================================
// 対象: dynamicnekoのAI問い合わせウィジェットから "/neko aireqst" を送ると、
// AIを呼ばずローカルで応答する(本体WorkerのAIチャット/neko aireqstと同じ処理)。
// 故障シナリオ: (1) emailに紐づく登録済みloginが渡らずuser_idスコープが特定できない
//              (2) D1クエリ失敗時にエラーが握りつぶされる
//              (3) 未許可メールアドレスがAI呼び出し同様にaireqstも回避できてしまう
//              (4)(セキュリティ) リクエスト本文のloginを別ユーザーの値に差し替えても、
//                  サーバー側で解決されたemail自身のloginだけが使われる
function createMockDbWithSourceRows(allowedUsers: Record<string, string>, sourceRows: Array<{ source: string | null; q_count: number }>) {
  const prepare = vi.fn().mockImplementation((sql: string) => ({
    bind: vi.fn().mockImplementation((...args: unknown[]) => ({
      first: vi.fn().mockImplementation(() => {
        const email = args[0] as string;
        const login = allowedUsers[email];
        if (login === undefined) return Promise.resolve(null);
        if (sql.includes('github_login')) return Promise.resolve({ github_login: login });
        return Promise.resolve({ 1: 1 });
      }),
      all: vi.fn().mockResolvedValue({ results: sourceRows }),
    })),
  }));
  return { prepare } as unknown as D1Database;
}

describe('POST /api/aichat/query-external: /neko aireqst', () => {
  it('AIバインディングを呼ばずanswerとsvgを返す', async () => {
    const db = createMockDbWithSourceRows({ 'ok@example.com': 'nekoserver' }, [
      { source: 'textbox', q_count: 5 },
      { source: 'slack', q_count: 2 },
    ]);
    const aiRun = vi.fn();
    const res = await app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', question: '/neko aireqst' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db, AI: { run: aiRun } }
    );
    expect(res.status).toBe(200);
    expect(aiRun).not.toHaveBeenCalled();
    const body = await res.json() as { answer: string; svg: string | null };
    expect(body.answer).toContain('リクエスト元別統計(今月)');
    expect(body.svg).toContain('<svg');
  });

  it('大文字小文字や前後の空白を無視して判定する', async () => {
    const db = createMockDbWithSourceRows({ 'ok@example.com': 'nekoserver' }, [{ source: 'textbox', q_count: 1 }]);
    const res = await app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', question: '  /NEKO AIREQST  ' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db }
    );
    expect(res.status).toBe(200);
  });

  it('許可済みだがgithub_login未登録のメールアドレスは500を返す', async () => {
    const db = createMockDbWithSourceRows({ 'ok@example.com': '' }, []);
    const res = await app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', question: '/neko aireqst' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db }
    );
    expect(res.status).toBe(500);
  });

  it('未許可メールアドレスは403で拒否される(AIバインディング未呼び出しと同じ扱い)', async () => {
    const db = createMockDbWithSourceRows({ 'ok@example.com': 'nekoserver' }, [{ source: 'textbox', q_count: 1 }]);
    const res = await app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ng@example.com', question: '/neko aireqst' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db }
    );
    expect(res.status).toBe(403);
  });

  it('リクエスト本文にloginを含めて他ユーザーを騙ろうとしても無視され、emailに紐づく自分のloginだけが使われる(脆弱性の再発防止)', async () => {
    let capturedUserId: string | null = null;
    const prepare = vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockImplementation((...args: unknown[]) => ({
        first: vi.fn().mockImplementation(() => {
          const arg0 = args[0] as string;
          if (sql.includes('github_login')) {
            return Promise.resolve(arg0 === 'ok@example.com' ? { github_login: 'nekoserver' } : null);
          }
          return Promise.resolve(arg0 === 'ok@example.com' ? { 1: 1 } : null);
        }),
        all: vi.fn().mockImplementation(() => {
          capturedUserId = args[0] as string;
          return Promise.resolve({ results: [] });
        }),
      })),
    }));
    const db = { prepare } as unknown as D1Database;
    const res = await app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', question: '/neko aireqst', login: 'victim-user' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db }
    );
    expect(res.status).toBe(200);
    expect(capturedUserId).toBe('nekoserver');
    expect(capturedUserId).not.toBe('victim-user');
  });

  it('D1クエリが失敗した場合は500でエラー内容を返す(握りつぶさない)', async () => {
    const prepare = vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockImplementation((...args: unknown[]) => ({
        first: vi.fn().mockImplementation(() => {
          const email = args[0] as string;
          if (email !== 'ok@example.com') return Promise.resolve(null);
          if (sql.includes('github_login')) return Promise.resolve({ github_login: 'nekoserver' });
          return Promise.resolve({ 1: 1 });
        }),
        all: vi.fn().mockRejectedValue(new Error('D1 unavailable')),
      })),
    }));
    const db = { prepare } as unknown as D1Database;
    const res = await app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', question: '/neko aireqst' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db }
    );
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('D1 unavailable');
  });

  it('全件0件の場合はsvgがnullで返る', async () => {
    const db = createMockDbWithSourceRows({ 'ok@example.com': 'nekoserver' }, []);
    const res = await app.request(
      '/api/aichat/query-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', question: '/neko aireqst' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: db }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { answer: string; svg: string | null };
    expect(body.svg).toBeNull();
  });
});
