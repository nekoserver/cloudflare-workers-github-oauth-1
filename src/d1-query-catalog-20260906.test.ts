/**
 * GET /d1-query-catalog ページのテスト
 *
 * 対象: src/index.ts の db.prepare() 呼び出しから合成したsqlc風クエリ
 * カタログをD1(d1_query_catalog)から読み出して一覧表示するページ。
 *
 * 故障シナリオ:
 *   (1) DB未設定・クエリ失敗時にページ全体がエラーにならず空一覧で表示される
 *   (2) ユーザー名によるXSS
 *   (3) SQL本文・クエリ名にHTML特殊文字が含まれてもエスケープされる
 */
import { describe, it, expect, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { getD1QueryCatalogPage } from './views/d1QueryCatalog';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function createMockDb(rows: Record<string, unknown>[] = []) {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockImplementation(() => {
          if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
          return Promise.resolve(null);
        }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
      first: vi.fn().mockImplementation(() => {
        if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
        return Promise.resolve(null);
      }),
      all: vi.fn().mockImplementation(() => {
        if (sql.includes('d1_query_catalog')) return Promise.resolve({ results: rows });
        return Promise.resolve({ results: [] });
      }),
      run: vi.fn().mockResolvedValue({ success: true }),
    })),
  };
}

describe('GET /d1-query-catalog', () => {
  it('ページが200で返り、タイトルが含まれる', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/d1-query-catalog',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb() }
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('D1クエリカタログ');
  });

  it('DBクエリが失敗しても500にならず空一覧で表示される', async () => {
    const authHeader = await makeAuthHeader();
    const failingDb = {
      prepare: vi.fn().mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ revoked_at: null }),
          all: vi.fn().mockRejectedValue(new Error('db error')),
        }),
        first: vi.fn().mockResolvedValue({ revoked_at: null }),
        all: vi.fn().mockRejectedValue(new Error('db error')),
      })),
    };
    const res = await app.request(
      '/d1-query-catalog',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: failingDb }
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('データがありません');
  });

  it('ユーザー名はエスケープされる', () => {
    const html = getD1QueryCatalogPage('<script>alert(1)</script>', []);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('クエリ名・SQL本文のHTML特殊文字がエスケープされる', () => {
    const html = getD1QueryCatalogPage('tester', [
      {
        query_name: '<b>Evil</b>',
        command: 'exec',
        command_confirmed: 1,
        table_name: 'foo',
        source_file: 'src/index.ts',
        source_line: 1,
        sql_text: "SELECT '<img src=x onerror=alert(1)>' FROM foo",
        migration_file: null,
        last_commit_hash: null,
      },
    ]);
    expect(html).not.toContain('<b>Evil</b>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });

  it('コマンド確定件数がサマリに表示される', () => {
    const html = getD1QueryCatalogPage('tester', [
      { query_name: 'A', command: 'one', command_confirmed: 1, table_name: 't', source_file: 'src/index.ts', source_line: 1, sql_text: 'SELECT 1', migration_file: null, last_commit_hash: null },
      { query_name: 'B', command: 'exec', command_confirmed: 0, table_name: 't', source_file: 'src/index.ts', source_line: 2, sql_text: 'DELETE FROM t', migration_file: null, last_commit_hash: null },
    ]);
    expect(html).toContain('2件中、コマンド種別確定済み1件');
  });
});
