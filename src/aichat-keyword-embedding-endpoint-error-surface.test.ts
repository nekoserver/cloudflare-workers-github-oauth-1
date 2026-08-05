/**
 * /api/aichat/keyword-embeddings/register, /list エンドポイントの統合テスト
 *
 * 対象: 両エンドポイントのtry/catch。マイグレーション未適用などでSQLが
 * 例外を投げた場合、Honoのグローバル app.onError による汎用
 * 「サーバーエラーが発生しました」ではなく、実際の例外メッセージを含む
 * エラー文言をJSONレスポンスに含めて返すことを保証する。
 *
 * 故障シナリオ:
 *   (1) DBがエラーを投げても登録/一覧取得が例外を伝播させ、
 *       app.onErrorの汎用メッセージに丸められてしまい原因が追えない
 *   (2) 正常系でエラーメッセージが混入してしまう(誤検知)
 */
import { describe, it, expect, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function makeEnv(db: unknown, ai: unknown) {
  return {
    DB: db,
    AI: ai,
    GITHUB_CLIENT_ID: 'test',
    GITHUB_CLIENT_SECRET: 'test',
    JWT_SECRET,
    ANALYTICS: undefined,
  };
}

function makeThrowingDb(message: string) {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('user_sessions')) {
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({}),
          }),
        };
      }
      return {
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockRejectedValue(new Error(message)),
          all: vi.fn().mockRejectedValue(new Error(message)),
          run: vi.fn().mockRejectedValue(new Error(message)),
        }),
      };
    }),
  };
}

describe('/api/aichat/keyword-embeddings/register: SQLエラー時の応答', () => {
  it('DBが例外を投げた場合、汎用500ではなく実際のエラーメッセージを含んだJSONを返す', async () => {
    const db = makeThrowingDb('no such column: source');
    const ai = { run: vi.fn().mockResolvedValue({ data: [[1, 2, 3]] }) };
    const auth = await makeAuthHeader();

    const res = await app.request('/api/aichat/keyword-embeddings/register', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: ['駅'] }),
    }, makeEnv(db, ai));

    expect(res.status).toBe(500);
    const data = await res.json() as { error?: string };
    expect(data.error).toBeTruthy();
    expect(data.error).not.toBe('サーバーエラーが発生しました');
    expect(data.error).toContain('no such column: source');
  });
});

describe('/api/aichat/keyword-embeddings/list: SQLエラー時の応答', () => {
  it('DBが例外を投げた場合、汎用500ではなく実際のエラーメッセージを含んだJSONを返す', async () => {
    const db = makeThrowingDb('no such column: plamo_model');
    const auth = await makeAuthHeader();

    const res = await app.request('/api/aichat/keyword-embeddings/list', {
      headers: { Authorization: auth },
    }, makeEnv(db, undefined));

    expect(res.status).toBe(500);
    const data = await res.json() as { items: unknown[]; error?: string };
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.error).toBeTruthy();
    expect(data.error).not.toBe('サーバーエラーが発生しました');
    expect(data.error).toContain('no such column: plamo_model');
  });
});

describe('/api/aichat/keyword-embeddings/model-counts: SQLエラー時の応答', () => {
  it('DBが例外を投げた場合、汎用500ではなく実際のエラーメッセージを含んだJSONを返す', async () => {
    const db = makeThrowingDb('no such column: gemma_dim');
    const auth = await makeAuthHeader();

    const res = await app.request('/api/aichat/keyword-embeddings/model-counts', {
      headers: { Authorization: auth },
    }, makeEnv(db, undefined));

    expect(res.status).toBe(500);
    const data = await res.json() as { bge: number; plamo: number; gemma: number; error?: string };
    expect(data).toMatchObject({ bge: 0, plamo: 0, gemma: 0 });
    expect(data.error).toBeTruthy();
    expect(data.error).not.toBe('サーバーエラーが発生しました');
    expect(data.error).toContain('no such column: gemma_dim');
  });
});
