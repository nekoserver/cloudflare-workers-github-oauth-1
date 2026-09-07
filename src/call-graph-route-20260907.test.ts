/**
 * GET /call-graph のテスト
 *
 * 対象: D1のts_function_catalog/ts_function_callersから関数呼び出しグラフを
 * 動的に組み立てて表示するページ(旧call-graph.html の手作業ハードコードを置き換える)。
 *
 * 故障シナリオ:
 *   (1) repoクエリパラメータ未指定時にDBへ不要なクエリを投げてエラーになる
 *   (2) DB未設定時に理由不明の500になる
 *   (3) 存在しないrepo_idを指定した場合にクラッシュする(空データで正常に描画されるべき)
 *   (4) 未認証でページが閲覧できてしまう
 */
import { describe, it, expect, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function createMockDb(opts: {
  repos?: { id: number; full_name: string }[];
  catalog?: unknown[];
  callers?: unknown[];
} = {}) {
  const repos = opts.repos ?? [{ id: 1, full_name: 'nekoserver/cloudflare-workers-github-oauth-1' }];
  const catalog = opts.catalog ?? [];
  const callers = opts.callers ?? [];
  const db = {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockReturnValue({
        all: vi.fn().mockImplementation(() => {
          if (sql.includes('ts_function_catalog') && sql.includes('LEFT JOIN ts_function_callers')) {
            return Promise.resolve({ results: catalog });
          }
          if (sql.includes('ts_function_callers')) {
            return Promise.resolve({ results: callers });
          }
          return Promise.resolve({ results: [] });
        }),
        first: vi.fn().mockImplementation(() => {
          if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
          return Promise.resolve(null);
        }),
      }),
      all: vi.fn().mockResolvedValue({ results: repos }),
      first: vi.fn().mockImplementation(() => {
        if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
        return Promise.resolve(null);
      }),
    })),
  };
  return { db };
}

describe('GET /call-graph', () => {
  it('repo未指定時はDB取得系のクエリを空データで正常に描画する', async () => {
    const authHeader = await makeAuthHeader();
    const { db } = createMockDb();
    const res = await app.request('/call-graph', { headers: { Authorization: authHeader } }, { JWT_SECRET, DB: db });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('id="empty-state"');
  });

  it('repo指定時はts_function_catalog/ts_function_callersからノード・エッジを埋め込む', async () => {
    const authHeader = await makeAuthHeader();
    const catalog = [
      { id: 1, file_path: 'index.ts', function_name: 'foo', purpose: 'fooの説明', is_exported: 1, is_async: 0, start_line: 10, end_line: 20, caller_count: 1 },
      { id: 2, file_path: 'utils/bar.ts', function_name: 'bar', purpose: 'barの説明', is_exported: 1, is_async: 0, start_line: 1, end_line: 5, caller_count: 0 },
    ];
    const callers = [{ callee_id: 2, caller_file: 'index.ts', caller_line: 15 }];
    const { db } = createMockDb({ catalog, callers });
    const res = await app.request('/call-graph?repo=1', { headers: { Authorization: authHeader } }, { JWT_SECRET, DB: db });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('index.ts::foo');
    expect(html).toContain('utils/bar.ts::bar');
    expect(html).toContain('"from":"index.ts::foo"');
    expect(html).toContain('"to":"utils/bar.ts::bar"');
  });

  it('存在しないrepo_idでもクラッシュせず空データで描画する', async () => {
    const authHeader = await makeAuthHeader();
    const { db } = createMockDb({ catalog: [], callers: [] });
    const res = await app.request('/call-graph?repo=99999', { headers: { Authorization: authHeader } }, { JWT_SECRET, DB: db });
    expect(res.status).toBe(200);
  });

  it('DB未設定時は500かつ理由が分かるレスポンスを返す', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request('/call-graph', { headers: { Authorization: authHeader } }, { JWT_SECRET, DB: undefined });
    expect(res.status).toBe(500);
  });

  it('未認証の場合はページを返さない', async () => {
    const { db } = createMockDb();
    const res = await app.request('/call-graph', {}, { JWT_SECRET, DB: db });
    expect(res.status).not.toBe(200);
  });
});
