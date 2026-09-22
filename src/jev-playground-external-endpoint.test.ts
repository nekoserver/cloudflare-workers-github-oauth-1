/**
 * POST /api/jev-playground-external のテスト
 *
 * 対象: dynamicnekoの/jev-pg-reactページ(jev-playgroundのReact移植)向けの
 * external API。既存の POST /api/jev-playground(cookieセッション認証)と
 * 同じ検証(validateJevPlaygroundPayload)・Jev API転送(callJevPlaygroundApi)
 * ロジックを共有しつつ、Bearer secret + userToken認可(他のexternal API群と
 * 同じ)で提供する。
 *
 * 故障シナリオ:
 *   (1) Bearer secretが一致しないリクエストが素通りしてしまう
 *   (2) userTokenが無い/偽造されている場合に本文の生emailを信用してしまう
 *   (3) 未許可メールアドレスがJev API呼び出しまで到達してしまう
 *   (4) state/questionsの検証が本体版(/api/jev-playground)と食い違う
 *   (5) Jev APIのレスポンス(ステータス・ボディ)を握りつぶして別の内容に
 *       変換してしまう
 *   (6) JEV_API_KEY未設定時にJev APIへリクエストを試みてしまう
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';

const SECRET = 'test-aichat-external-secret';
const USER_TOKEN_SECRET = 'test-user-token-secret';
const JEV_API_KEY = 'test-jev-api-key';

function makeUserToken(email: string, secret: string = USER_TOKEN_SECRET, expiresIn = 60): Promise<string> {
  return createJWT({ sub: email }, secret, expiresIn);
}

function wrapD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      const makeChain = (args: unknown[]) => ({
        async first<T>(): Promise<T | null> {
          const row = stmt.get(...(args as never[]));
          return (row ?? null) as T | null;
        },
        bind(...innerArgs: unknown[]) {
          return makeChain(innerArgs);
        },
      });
      return makeChain([]);
    },
  };
}

function setupDb(allowedEmails: string[]): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE dynamicneko_aichat_allowed_users (email TEXT PRIMARY KEY, github_login TEXT);`);
  for (const email of allowedEmails) {
    db.prepare(`INSERT INTO dynamicneko_aichat_allowed_users (email, github_login) VALUES (?, ?)`).run(email, null);
  }
  return db;
}

const BASE_ENV = { AICHAT_EXTERNAL_SECRET: SECRET, AICHAT_USER_TOKEN_SECRET: USER_TOKEN_SECRET, JEV_API_KEY };

async function postExternal(db: DatabaseSync, body: Record<string, unknown>, authHeader = `Bearer ${SECRET}`, env: Record<string, unknown> = {}): Promise<Response> {
  return app.request(
    '/api/jev-playground-external',
    { method: 'POST', headers: { Authorization: authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    { ...BASE_ENV, ...env, DB: wrapD1(db) }
  );
}

const VALID_BODY = {
  state: '条件が成立しています。',
  questions: { condition: { type: 'noul', question: '成立しているか？', instructions: '成立するならyes' } },
};

afterEach(() => { vi.unstubAllGlobals(); });

describe('POST /api/jev-playground-external', () => {
  it('Bearer secretが一致しない場合は401', async () => {
    const db = setupDb(['ok@example.com']);
    const res = await postExternal(db, { userToken: 'x', ...VALID_BODY }, 'Bearer wrong');
    expect(res.status).toBe(401);
  });

  it('userTokenが無い場合は401(本文のemailを信用しない)', async () => {
    const db = setupDb(['ok@example.com']);
    const res = await postExternal(db, { email: 'ok@example.com', ...VALID_BODY });
    expect(res.status).toBe(401);
  });

  it('偽造されたuserToken(別のsecretで署名)は401', async () => {
    const db = setupDb(['ok@example.com']);
    const forgedToken = await makeUserToken('ok@example.com', 'wrong-secret');
    const res = await postExternal(db, { userToken: forgedToken, ...VALID_BODY });
    expect(res.status).toBe(401);
  });

  it('未許可メールアドレスは403で、Jev APIは呼ばれない', async () => {
    const db = setupDb(['ok@example.com']);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const userToken = await makeUserToken('ng@example.com');
    const res = await postExternal(db, { userToken, ...VALID_BODY });
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stateが空文字の場合は400で、Jev APIは呼ばれない', async () => {
    const db = setupDb(['ok@example.com']);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal(db, { userToken, state: '', questions: VALID_BODY.questions });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('questionsが21件を超える場合は400', async () => {
    const db = setupDb(['ok@example.com']);
    const userToken = await makeUserToken('ok@example.com');
    const questions: Record<string, unknown> = {};
    for (let i = 0; i < 21; i++) {
      questions[`q${i}`] = { type: 'noul', question: 'q' };
    }
    const res = await postExternal(db, { userToken, state: 'state', questions });
    expect(res.status).toBe(400);
  });

  it('質問のtypeがnoul/choice/score以外の場合は400', async () => {
    const db = setupDb(['ok@example.com']);
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal(db, { userToken, state: 'state', questions: { q: { type: 'unknown', question: 'q' } } });
    expect(res.status).toBe(400);
  });

  it('JEV_API_KEY未設定の場合は503で、Jev APIは呼ばれない', async () => {
    const db = setupDb(['ok@example.com']);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal(db, { userToken, ...VALID_BODY }, `Bearer ${SECRET}`, { JEV_API_KEY: undefined });
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('正常系: 検証済みpayloadをJev APIへ転送し、レスポンスをそのまま返す', async () => {
    const db = setupDb(['ok@example.com']);
    let sentBody: unknown = null;
    let sentAuth: string | null = null;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://api.typesafe.ai/v1/systemone');
      sentBody = JSON.parse(String(init?.body ?? '{}'));
      sentAuth = (init?.headers as Record<string, string>)?.Authorization ?? null;
      return new Response(JSON.stringify({ results: { condition: 'yes' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal(db, { userToken, ...VALID_BODY });
    expect(res.status).toBe(200);
    const body = await res.json() as { results: { condition: string } };
    expect(body.results.condition).toBe('yes');
    expect(sentAuth).toBe(`Bearer ${JEV_API_KEY}`);
    expect(sentBody).toMatchObject({ state: VALID_BODY.state, model: 'jev-latest' });
    // userTokenは本文からJev APIへ転送しない(不要な情報を漏らさない)。
    expect(sentBody).not.toHaveProperty('userToken');
  });

  it('Jev API接続失敗時は502を返し、握りつぶさない', async () => {
    const db = setupDb(['ok@example.com']);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal(db, { userToken, ...VALID_BODY });
    expect(res.status).toBe(502);
  });
});
