import { describe, expect, it } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

/**
 * 対象: GET /api/api-keys/:id/stats。🔑キー管理ページの使用統計表示用。
 *
 * 故障シナリオ:
 *   (1) 未認証は401
 *   (2) 他ユーザーが発行したAPIキーのidを指定しても見えない(404)
 *   (3) 存在しないキーidは404
 *   (4) 正常系: api_key_endpoint_statsの行がエンドポイント別・日別・月別に
 *       正しく集計されて返る
 */
const JWT_SECRET = 'test-secret';

async function authHeader(sub = 'test-user') {
  return `Bearer ${await createJWT({ sub, name: 'Test' }, JWT_SECRET)}`;
}

type StatRow = { key_id: string; day: string; endpoint: string; status_code: number; count: number };

function createMockDb(apiKeys: { id: string; user_id: string }[], stats: StatRow[]) {
  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T>(): Promise<T | null> {
              if (sql.includes('FROM api_keys WHERE id')) {
                const [id, userId] = params as [string, string];
                const row = apiKeys.find((k) => k.id === id && k.user_id === userId);
                return (row ?? null) as T | null;
              }
              return null;
            },
            async all<T>(): Promise<{ results?: T[] }> {
              if (sql.includes('FROM api_key_endpoint_stats')) {
                const [keyId] = params as [string];
                return { results: stats.filter((s) => s.key_id === keyId) as unknown as T[] };
              }
              return { results: [] };
            },
          };
        },
      };
    },
  };
  return db;
}

async function getStats(db: ReturnType<typeof createMockDb>, keyId: string, sub = 'test-user') {
  return app.request(`/api/api-keys/${keyId}/stats`, {
    headers: { Authorization: await authHeader(sub) },
  }, { JWT_SECRET, DB: db });
}

describe('GET /api/api-keys/:id/stats', () => {
  it('未認証は401', async () => {
    const db = createMockDb([], []);
    const res = await app.request(`/api/api-keys/key1/stats`, {}, { JWT_SECRET, DB: db });
    expect(res.status).toBe(401);
  });

  it('存在しないキーidは404', async () => {
    const db = createMockDb([], []);
    const res = await getStats(db, 'nonexistent');
    expect(res.status).toBe(404);
  });

  it('他ユーザーが発行したAPIキーは404(自分のキーとして見えない)', async () => {
    const db = createMockDb([{ id: 'key1', user_id: 'other-user' }], []);
    const res = await getStats(db, 'key1', 'test-user');
    expect(res.status).toBe(404);
  });

  it('正常系: エンドポイント別・日別・月別に集計して返す', async () => {
    const db = createMockDb(
      [{ id: 'key1', user_id: 'test-user' }],
      [
        { key_id: 'key1', day: '2026-06-01', endpoint: 'POST /api/aichat', status_code: 200, count: 5 },
        { key_id: 'key1', day: '2026-06-02', endpoint: 'POST /api/aichat', status_code: 200, count: 2 },
        { key_id: 'key1', day: '2026-07-01', endpoint: 'POST /api/aichat', status_code: 401, count: 1 },
        { key_id: 'other-key', day: '2026-06-01', endpoint: 'POST /api/aichat', status_code: 200, count: 99 },
      ],
    );
    const res = await getStats(db, 'key1');
    expect(res.status).toBe(200);
    const body = await res.json() as {
      totalCount: number;
      byEndpoint: { endpoint: string; count: number }[];
      byDay: { day: string; count: number }[];
      byMonth: { month: string; count: number }[];
    };
    expect(body.totalCount).toBe(8);
    expect(body.byEndpoint).toEqual([{ endpoint: 'POST /api/aichat', count: 8 }]);
    expect(body.byMonth).toEqual([
      { month: '2026-06', count: 7 },
      { month: '2026-07', count: 1 },
    ]);
  });
});
