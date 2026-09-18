/**
 * GET /api/aichat/jev-values のテスト
 *
 * 対象: AIチャットの詳細プレビューモーダル(historyModal)の📔ボタンから呼ばれる。
 * 表示中の回答バブルのshare_idについて、jev_label_id=1〜20(ループA)の
 * jev_evaluations.valueを順番に並べて返す。
 *
 * 故障シナリオ:
 *   (1) 未認証で叩けてしまう
 *   (2) shareId未指定で500になる(400を返すべき)
 *   (3) 他ユーザーのjev_evaluationsが混ざる(user_idで絞り込まれていない)
 *   (4) DBクエリ失敗時にページ全体が落ちる(500かつエラー内容を返すべき)
 */
import { describe, it, expect, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader(sub = 'test-user') {
  const token = await createJWT({ sub, name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function createMockDb(rows: { jev_label_id: number; value: number }[]) {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockImplementation((...args: unknown[]) => ({
        first: vi.fn().mockResolvedValue({ revoked_at: null }),
        all: vi.fn().mockImplementation(() => {
          if (sql.includes('jev_evaluations')) {
            const userId = args[1];
            return Promise.resolve({ results: userId === 'test-user' ? rows : [] });
          }
          return Promise.resolve({ results: [] });
        }),
      })),
      first: vi.fn().mockImplementation(() => {
        if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
        return Promise.resolve(null);
      }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    })),
  };
}

describe('GET /api/aichat/jev-values', () => {
  it('認証無しでは401になる', async () => {
    const res = await app.request('/api/aichat/jev-values?shareId=abc', {}, { JWT_SECRET, DB: createMockDb([]) });
    expect(res.status).toBe(401);
  });

  it('shareId未指定は400になる', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/aichat/jev-values',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb([]) },
    );
    expect(res.status).toBe(400);
  });

  it('1〜20件のvalueをjevLabelId順に返す(該当行が無いIDはnull)。1件でもあればstateはgreen', async () => {
    const authHeader = await makeAuthHeader();
    const rows = [
      { jev_label_id: 1, value: 0.8 },
      { jev_label_id: 5, value: 0.2 },
    ];
    const res = await app.request(
      '/api/aichat/jev-values?shareId=abc&model=gpt-test',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb(rows) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { values: { jevLabelId: number; value: number | null }[]; state: string; tableMissing: boolean };
    expect(body.values).toHaveLength(20);
    expect(body.values[0]).toEqual({ jevLabelId: 1, value: 0.8 });
    expect(body.values[1]).toEqual({ jevLabelId: 2, value: null });
    expect(body.values[4]).toEqual({ jevLabelId: 5, value: 0.2 });
    expect(body.state).toBe('green');
    expect(body.tableMissing).toBe(false);
  });

  it('評価データが1件も無ければstateはyellow', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/aichat/jev-values?shareId=abc',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb([]) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { state: string };
    expect(body.state).toBe('yellow');
  });

  it('他ユーザーのuser_idでは評価値が返らない(user_idで絞り込まれる)', async () => {
    const authHeader = await makeAuthHeader('other-user');
    const rows = [{ jev_label_id: 1, value: 0.9 }];
    const res = await app.request(
      '/api/aichat/jev-values?shareId=abc',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb(rows) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { values: { jevLabelId: number; value: number | null }[] };
    expect(body.values.every((v) => v.value === null)).toBe(true);
  });

  it('テーブル自体が存在しない場合は500ではなく200・state=pink・tableMissing=trueを返す', async () => {
    const authHeader = await makeAuthHeader();
    const missingTableDb = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ revoked_at: null }),
          all: vi.fn().mockRejectedValue(new Error('D1_ERROR: no such table: jev_evaluations')),
        }),
        first: vi.fn().mockImplementation(() => {
          if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
          return Promise.resolve(null);
        }),
        all: vi.fn().mockResolvedValue({ results: [] }),
      })),
    };
    const res = await app.request(
      '/api/aichat/jev-values?shareId=abc',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: missingTableDb },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { state: string; tableMissing: boolean };
    expect(body.state).toBe('pink');
    expect(body.tableMissing).toBe(true);
  });

  it('テーブル欠落以外のDBクエリ失敗は500かつエラー内容を返す', async () => {
    const authHeader = await makeAuthHeader();
    const failingDb = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ revoked_at: null }),
          all: vi.fn().mockRejectedValue(new Error('db error')),
        }),
        first: vi.fn().mockImplementation(() => {
          if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
          return Promise.resolve(null);
        }),
        all: vi.fn().mockResolvedValue({ results: [] }),
      })),
    };
    const res = await app.request(
      '/api/aichat/jev-values?shareId=abc',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: failingDb },
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('jev_evaluations');
  });
});
