/**
 * POST /api/clef-playground・/api/clef-playground-external のテスト
 *
 * 対象: Cloudflare Workers AIのClef決定モデル(@cf/cloudflare/clef・
 * clef-flash)を試し呼びするプレイグラウンド。Clefは「Jev互換」
 * (state+questions、質問type=noul/choice/scoreが同じ形)を公式に名乗って
 * いるため、/api/jev-playground・/api/jev-playground-externalと同じ
 * validateJevPlaygroundPayloadを使い、呼び出し先だけがAPIキー経由の外部
 * HTTP(Jev)ではなくWorkers AIバインディング(env.AI)になっている。
 *
 * 故障シナリオ:
 *   (1) AIバインディング未設定でもAI.run相当を試みて例外で落ちてしまう
 *   (2) state/questionsの検証が漏れ、不正なpayloadでもAI.runを呼んでしまう
 *   (3) 未知のmodel文字列(clef-omni含む。音声・動画対応で別スキーマと
 *       見られ、本エンドポイントのスキーマ非対応)をそのままAI.run()へ渡し、
 *       非対応のモデルIDで呼び出してしまう
 *       (resolveClefPlaygroundModelでフォールバックすべき)
 *   (3.5) input.modelにカタログの完全なID(@cf/cloudflare/clef-flash等)を
 *       渡してしまう(2026-10-11実機で確認: 短い名前clef/clef-flashのみ
 *       正規表現を通る)
 *   (4) AI.run失敗時に握りつぶして200を返してしまう
 *   (5) (externalのみ) Bearer secretが一致しないリクエストが素通りしてしまう
 *   (6) (externalのみ) userTokenが無い/偽造されている場合に本文の生emailを
 *       信用してしまう
 *   (7) (externalのみ) 未許可メールアドレスがAI.run呼び出しまで到達してしまう
 */
import { describe, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';

const SECRET = 'test-clef-playground-external-secret';
const USER_TOKEN_SECRET = 'test-user-token-secret';

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

const VALID_BODY = {
  state: '条件が成立しています。',
  questions: { condition: { type: 'noul', question: '成立しているか？', instructions: '成立するならyes' } },
};

function makeAiEnv(run: ReturnType<typeof vi.fn>) {
  return { AI: { run } };
}

describe('POST /api/clef-playground-external', () => {
  const BASE_ENV = { CLEF_PLAYGROUND_EXTERNAL_SECRET: SECRET, AICHAT_USER_TOKEN_SECRET: USER_TOKEN_SECRET };

  async function postExternal(db: DatabaseSync, body: Record<string, unknown>, authHeader = `Bearer ${SECRET}`, env: Record<string, unknown> = {}): Promise<Response> {
    return app.request(
      '/api/clef-playground-external',
      { method: 'POST', headers: { Authorization: authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      { ...BASE_ENV, ...env, DB: wrapD1(db) }
    );
  }

  it('Bearer secretが一致しない場合は401', async () => {
    const db = setupDb(['ok@example.com']);
    const res = await postExternal(db, { userToken: 'x', ...VALID_BODY }, 'Bearer wrong');
    expect(res.status).toBe(401);
  });

  it('他のexternal API用の共有secretでは認証できない', async () => {
    const db = setupDb(['ok@example.com']);
    const userToken = await makeUserToken('ok@example.com');
    const res = await app.request(
      '/api/clef-playground-external',
      { method: 'POST', headers: { Authorization: 'Bearer shared-aichat-secret', 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, ...VALID_BODY }) },
      { ...BASE_ENV, AICHAT_EXTERNAL_SECRET: 'shared-aichat-secret', DB: wrapD1(db), ...makeAiEnv(vi.fn()) },
    );
    expect(res.status).toBe(401);
  });

  it('専用Bearer secret未設定時は従来のAICHAT_EXTERNAL_SECRETへフォールバックする', async () => {
    const db = setupDb(['ok@example.com']);
    const userToken = await makeUserToken('ok@example.com');
    const run = vi.fn().mockResolvedValue({ answers: { condition: 0.9 } });
    const res = await app.request(
      '/api/clef-playground-external',
      { method: 'POST', headers: { Authorization: 'Bearer legacy-aichat-secret', 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, ...VALID_BODY }) },
      { AICHAT_EXTERNAL_SECRET: 'legacy-aichat-secret', AICHAT_USER_TOKEN_SECRET: USER_TOKEN_SECRET, DB: wrapD1(db), ...makeAiEnv(run) },
    );
    expect(res.status).toBe(200);
  });

  it('userTokenが無い場合は401(本文のemailを信用しない)', async () => {
    const db = setupDb(['ok@example.com']);
    const res = await postExternal(db, { email: 'ok@example.com', ...VALID_BODY }, `Bearer ${SECRET}`, makeAiEnv(vi.fn()));
    expect(res.status).toBe(401);
  });

  it('偽造されたuserToken(別のsecretで署名)は401', async () => {
    const db = setupDb(['ok@example.com']);
    const forgedToken = await makeUserToken('ok@example.com', 'wrong-secret');
    const res = await postExternal(db, { userToken: forgedToken, ...VALID_BODY }, `Bearer ${SECRET}`, makeAiEnv(vi.fn()));
    expect(res.status).toBe(401);
  });

  it('未許可メールアドレスは403で、AI.runは呼ばれない', async () => {
    const db = setupDb(['ok@example.com']);
    const run = vi.fn();
    const userToken = await makeUserToken('ng@example.com');
    const res = await postExternal(db, { userToken, ...VALID_BODY }, `Bearer ${SECRET}`, makeAiEnv(run));
    expect(res.status).toBe(403);
    expect(run).not.toHaveBeenCalled();
  });

  it('stateが空文字の場合は400で、AI.runは呼ばれない', async () => {
    const db = setupDb(['ok@example.com']);
    const run = vi.fn();
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal(db, { userToken, state: '', questions: VALID_BODY.questions }, `Bearer ${SECRET}`, makeAiEnv(run));
    expect(res.status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });

  it('質問のtypeがnoul/choice/score以外の場合は400', async () => {
    const db = setupDb(['ok@example.com']);
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal(db, { userToken, state: 'state', questions: { q: { type: 'unknown', question: 'q' } } }, `Bearer ${SECRET}`, makeAiEnv(vi.fn()));
    expect(res.status).toBe(400);
  });

  it('AIバインディング未設定の場合は503で、例外にせず握りつぶさない', async () => {
    const db = setupDb(['ok@example.com']);
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal(db, { userToken, ...VALID_BODY });
    expect(res.status).toBe(503);
  });

  it('未知のmodel文字列は既定モデル(clef-flash)へフォールバックしてAI.runへ渡す', async () => {
    const db = setupDb(['ok@example.com']);
    const run = vi.fn().mockResolvedValue({ answers: { condition: 0.5 } });
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal(db, { userToken, model: 'not-a-real-model', ...VALID_BODY }, `Bearer ${SECRET}`, makeAiEnv(run));
    expect(res.status).toBe(200);
    // input.modelは短い名前(clef-flash)。ai.run()の第一引数はカタログの
    // 完全なID(@cf/cloudflare/clef-flash)のまま(2026-10-11実機で確認)。
    expect(run).toHaveBeenCalledWith('@cf/cloudflare/clef-flash', expect.objectContaining({ model: 'clef-flash', state: VALID_BODY.state }));
  });

  it('clef-omniは本エンドポイントのスキーマ非対応のため既定モデル(clef-flash)へフォールバックする', async () => {
    const db = setupDb(['ok@example.com']);
    const run = vi.fn().mockResolvedValue({ answers: { condition: 0.5 } });
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal(db, { userToken, model: '@cf/cloudflare/clef-omni', ...VALID_BODY }, `Bearer ${SECRET}`, makeAiEnv(run));
    expect(res.status).toBe(200);
    expect(run).toHaveBeenCalledWith('@cf/cloudflare/clef-flash', expect.objectContaining({ model: 'clef-flash' }));
  });

  it('正常系: 検証済みpayloadでAI.runを呼び、resultを展開したレスポンスを返す', async () => {
    const db = setupDb(['ok@example.com']);
    const run = vi.fn().mockResolvedValue({ answers: { condition: { noul: 0.92 } } });
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal(db, { userToken, model: '@cf/cloudflare/clef', ...VALID_BODY }, `Bearer ${SECRET}`, makeAiEnv(run));
    expect(res.status).toBe(200);
    const body = await res.json() as { model: string; answers: { condition: { noul: number } } };
    expect(body.model).toBe('@cf/cloudflare/clef');
    expect(body.answers.condition.noul).toBe(0.92);
    // Workers AI側のClefはinputオブジェクト自体にもmodelを必須として
    // 要求するが、その値は短い名前(clef)でなければならない
    // (2026-10-11、実機で確認。詳細はutils/clefPlayground.test.ts参照)。
    expect(run).toHaveBeenCalledWith('@cf/cloudflare/clef', { state: VALID_BODY.state, questions: VALID_BODY.questions, model: 'clef' });
    // userTokenはAI.runの入力(input)へ渡さない(クライアントの個人情報を
    // Workers AIへ送る必要が無い)。
    const [, input] = run.mock.calls[0];
    expect(input).not.toHaveProperty('userToken');
  });

  it('AI.run失敗時は502を返し、握りつぶさない', async () => {
    const db = setupDb(['ok@example.com']);
    const run = vi.fn().mockRejectedValue(new Error('binding unavailable'));
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal(db, { userToken, ...VALID_BODY }, `Bearer ${SECRET}`, makeAiEnv(run));
    expect(res.status).toBe(502);
  });
});
