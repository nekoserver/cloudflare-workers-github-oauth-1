/**
 * GET /jev-rev-viewer のテスト
 *
 * 対象: jev_evaluationsを質問ID(jev_label_id)ごとに集計し、
 * 「出現回数/質問ID/質問文」を出現回数の多い順に書き出す
 * <meta charset=utf-8><pre>...</pre>ページ。
 *
 * 故障シナリオ:
 *   (1) 未認証で叩けてしまう
 *   (2) DB未設定・クエリ失敗時に500ではなくページ全体が落ちる
 *   (3) 出現回数の並び替えが逆順・未ソートになる
 */
import { describe, it, expect, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function createMockDb(evaluationRows: { jev_label_id: number }[], labelRows: { id: number; question_text: string }[]) {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ revoked_at: null }),
        all: vi.fn().mockResolvedValue({ results: [] }),
      }),
      first: vi.fn().mockImplementation(() => {
        if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
        return Promise.resolve(null);
      }),
      all: vi.fn().mockImplementation(() => {
        if (sql.includes('jev_evaluations')) return Promise.resolve({ results: evaluationRows });
        if (sql.includes('jev_labels')) return Promise.resolve({ results: labelRows });
        return Promise.resolve({ results: [] });
      }),
    })),
  };
}

describe('GET /jev-rev-viewer', () => {
  it('認証無しでは401になる', async () => {
    const res = await app.request('/jev-rev-viewer', {}, { JWT_SECRET, DB: createMockDb([], []) });
    expect(res.status).toBe(401);
  });

  it('出現回数の多い順に「出現回数/質問ID/質問文」を書き出す', async () => {
    const authHeader = await makeAuthHeader();
    const evaluationRows = [
      { jev_label_id: 1 },
      { jev_label_id: 2 },
      { jev_label_id: 1 },
      { jev_label_id: 1 },
    ];
    const labelRows = [
      { id: 1, question_text: '事実性' },
      { id: 2, question_text: '根拠' },
    ];
    const res = await app.request(
      '/jev-rev-viewer',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb(evaluationRows, labelRows) },
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toBe('<meta charset=utf-8><pre>3/1/事実性\n1/2/根拠</pre>');
  });

  it('DBクエリが失敗しても500かつプレーンテキストで返る(ページ全体が落ちない)', async () => {
    const authHeader = await makeAuthHeader();
    const failingDb = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ revoked_at: null }),
        }),
        first: vi.fn().mockImplementation(() => {
          if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
          return Promise.resolve(null);
        }),
        all: vi.fn().mockRejectedValue(new Error('db error')),
      })),
    };
    const res = await app.request(
      '/jev-rev-viewer',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: failingDb },
    );
    expect(res.status).toBe(500);
    expect(res.headers.get('Content-Type')).toContain('text/plain');
  });

  it('評価が1件も無い場合は空のpreで200を返す', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/jev-rev-viewer',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb([], []) },
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<meta charset=utf-8><pre></pre>');
  });
});
