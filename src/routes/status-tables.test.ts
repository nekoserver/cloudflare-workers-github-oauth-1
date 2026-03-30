/**
 * /api/status/tables/:table/rows エンドポイントの統合テスト
 *
 * ai_summary_reviews を含む各テーブルのプレビューAPIが
 * 正しいカラムとデータを返すことを検証する。
 */
import { describe, it, expect, vi } from 'vitest';
import app from '../index';
import { createJWT } from '../utils/jwt';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function createMockDb(pragmaColumns: string[], rows: Record<string, unknown>[]) {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => {
      if (sql.startsWith('PRAGMA table_info')) {
        return {
          all: vi.fn().mockResolvedValue({
            results: pragmaColumns.map((name, i) => ({ cid: i, name, type: 'TEXT', notnull: 0, dflt_value: null, pk: i === 0 ? 1 : 0 })),
          }),
          bind: vi.fn().mockReturnThis(),
        };
      }
      if (sql.includes('user_sessions') && sql.includes('current_workspace_id')) {
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
          }),
        };
      }
      return {
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: rows }),
          first: vi.fn().mockResolvedValue(null),
        }),
        all: vi.fn().mockResolvedValue({ results: rows }),
      };
    }),
  };
}

function makeEnv(db: unknown) {
  return {
    DB: db,
    GITHUB_CLIENT_ID: 'test',
    GITHUB_CLIENT_SECRET: 'test',
    JWT_SECRET,
    ANALYTICS: undefined,
  };
}

describe('/api/status/tables/:table/rows', () => {
  const reviewColumns = ['id', 'summary_request_id', 'rating', 'reviewer_type', 'reviewer_name', 'review_model', 'comment', 'created_at'];
  const sampleReview = {
    id: 1,
    summary_request_id: 'uuid-001',
    rating: 'good',
    reviewer_type: 'system',
    reviewer_name: 'auto-diagnosis',
    review_model: '@cf/meta/llama-3.1-8b-instruct-fp8',
    comment: 'テスト要約',
    created_at: '2026-03-29T10:00:00Z',
    repo_full_name: 'owner/repo',
    pr_number: 42,
  };

  it('ai_summary_reviews: 200を返しrowsにデータが含まれる', async () => {
    const db = createMockDb(reviewColumns, [sampleReview]);
    const auth = await makeAuthHeader();
    const res = await app.request('/api/status/tables/ai_summary_reviews/rows', {
      headers: { Authorization: auth },
    }, makeEnv(db));

    expect(res.status).toBe(200);
    const data = await res.json() as { columns: string[]; rows: Record<string, unknown>[] };
    expect(data.rows.length).toBeGreaterThan(0);
    expect(data.rows[0]).toHaveProperty('summary_request_id', 'uuid-001');
  });

  it('ai_summary_reviews: columnsにテーブル定義のカラムが含まれる', async () => {
    const db = createMockDb(reviewColumns, [sampleReview]);
    const auth = await makeAuthHeader();
    const res = await app.request('/api/status/tables/ai_summary_reviews/rows', {
      headers: { Authorization: auth },
    }, makeEnv(db));

    const data = await res.json() as { columns: string[] };
    expect(data.columns).toContain('id');
    expect(data.columns).toContain('summary_request_id');
    expect(data.columns).toContain('rating');
    expect(data.columns).toContain('comment');
    expect(data.columns).toContain('created_at');
  });

  it('ai_summary_reviews: columnsの全キーでrows内の全行から値が取れること（正常終了保証）', async () => {
    const db = createMockDb(reviewColumns, [sampleReview]);
    const auth = await makeAuthHeader();
    const res = await app.request('/api/status/tables/ai_summary_reviews/rows', {
      headers: { Authorization: auth },
    }, makeEnv(db));

    expect(res.status).toBe(200);
    const data = await res.json() as { columns: string[]; rows: Record<string, unknown>[] };

    // columns が空でないこと（空ならクライアントは何も表示できない）
    expect(data.columns.length).toBeGreaterThan(0);

    // 全行について、columnsの全キーで undefined でない値が取れること
    // これが失敗する = クライアントで「全フィールド空」になる
    for (const row of data.rows) {
      for (const col of data.columns) {
        expect(row[col], `row[${col}] が undefined — クライアントで空セルになる`).not.toBeUndefined();
      }
    }
  });

  it('ai_summary_reviews: rowsに含まれる全キーがcolumnsにも含まれること（表示漏れ防止）', async () => {
    const db = createMockDb(reviewColumns, [sampleReview]);
    const auth = await makeAuthHeader();
    const res = await app.request('/api/status/tables/ai_summary_reviews/rows', {
      headers: { Authorization: auth },
    }, makeEnv(db));

    const data = await res.json() as { columns: string[]; rows: Record<string, unknown>[] };

    // rowsの全キーがcolumnsに含まれていなければ、そのカラムは表示されない
    // JOINカラム(repo_full_name, pr_number)もcolumnsに含まれるべき
    if (data.rows.length > 0) {
      const rowKeys = Object.keys(data.rows[0]);
      const missingColumns = rowKeys.filter(key => !data.columns.includes(key));
      expect(missingColumns, `rows にあるが columns にないキー — 表示されないカラム`).toEqual([]);
    }
  });

  it('ai_summary_reviews: rowsが空の場合でも正常にレスポンスを返す', async () => {
    const db = createMockDb(reviewColumns, []);
    const auth = await makeAuthHeader();
    const res = await app.request('/api/status/tables/ai_summary_reviews/rows', {
      headers: { Authorization: auth },
    }, makeEnv(db));

    expect(res.status).toBe(200);
    const data = await res.json() as { rows: unknown[] };
    expect(data.rows).toEqual([]);
  });

  it('存在しないテーブル名は404を返す', async () => {
    const db = createMockDb([], []);
    const auth = await makeAuthHeader();
    const res = await app.request('/api/status/tables/nonexistent_table/rows', {
      headers: { Authorization: auth },
    }, makeEnv(db));

    expect(res.status).toBe(404);
  });

  it('ai_summary_log: rowsにデータが含まれる', async () => {
    const logColumns = ['request_id', 'daily_seq', 'event_date', 'repo_full_name', 'pr_number', 'model', 'summary', 'created_at'];
    const sampleLog = {
      request_id: 'uuid-log-001',
      daily_seq: 1,
      event_date: '2026-03-29',
      repo_full_name: 'owner/repo',
      pr_number: 10,
      model: '@cf/meta/llama-3.1-8b-instruct-fp8',
      summary: 'テスト',
      created_at: '2026-03-29T10:00:00Z',
    };
    const db = createMockDb(logColumns, [sampleLog]);
    const auth = await makeAuthHeader();
    const res = await app.request('/api/status/tables/ai_summary_log/rows', {
      headers: { Authorization: auth },
    }, makeEnv(db));

    expect(res.status).toBe(200);
    const data = await res.json() as { rows: Record<string, unknown>[] };
    expect(data.rows.length).toBeGreaterThan(0);
    expect(data.rows[0]).toHaveProperty('request_id', 'uuid-log-001');
  });
});
