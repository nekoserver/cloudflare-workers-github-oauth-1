/**
 * GET /api/file-deps と GET /file-deps の統合テスト
 *
 * 対象: ast-grep(WASM)がscripts/index-file-deps.mjsでビルド時に抽出し
 * D1(ts_file_dependencies)へ保存したファイル間依存関係を、/file-depsページの
 * グラフ描画用にAPI経由で返す。
 *
 * 故障シナリオ:
 *   (1) D1に行が無い場合にAPIが例外を投げてページ全体が壊れる
 *   (2) nodes配列にsource_file/target_fileの重複が残ってしまう
 *      (グラフ描画側のnodeIdSetに同じノードが複数回入る想定はしていないため、
 *       APIレスポンス側でユニーク化しておく必要がある)
 */
import { describe, it, expect, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { getFileDepsPage } from './views/fileDeps';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function createMockDb(
  depRows: Record<string, unknown>[] = [],
  historyRows: Record<string, unknown>[] = [],
  rejectHistory = false,
) {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockImplementation(() => {
          if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
          return Promise.resolve(null);
        }),
        all: vi.fn().mockResolvedValue({
          results: sql.includes('ts_commit_function_map') ? historyRows : depRows,
        }),
      }),
      first: vi.fn().mockImplementation(() => {
        if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
        return Promise.resolve(null);
      }),
      all: vi.fn().mockImplementation(() => {
        if (rejectHistory && sql.includes('ts_commit_function_map')) {
          return Promise.reject(new Error('history table unavailable'));
        }
        return Promise.resolve({
          results: sql.includes('ts_commit_function_map') ? historyRows : depRows,
        });
      }),
    })),
  };
}

describe('GET /api/file-deps', () => {
  it('D1に行が無い場合、空のnodes/edgesを返す(例外を投げない)', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/file-deps',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb([]) }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { nodes: string[]; edges: { source: string; target: string }[] };
    expect(body.nodes).toEqual([]);
    expect(body.edges).toEqual([]);
  });

  it('依存エッジからノード一覧をユニーク化して返す', async () => {
    const authHeader = await makeAuthHeader();
    const depRows = [
      { source_file: 'src/index.ts', target_file: 'src/utils/jwt.ts' },
      { source_file: 'src/index.ts', target_file: 'src/views/aichat.ts' },
      { source_file: 'src/views/aichat.ts', target_file: 'src/utils/jwt.ts' },
    ];
    const res = await app.request(
      '/api/file-deps',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb(depRows) }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { nodes: string[]; edges: { source: string; target: string }[] };
    expect(body.nodes.sort()).toEqual(['src/index.ts', 'src/utils/jwt.ts', 'src/views/aichat.ts']);
    expect(body.edges).toHaveLength(3);
  });

  it('変更履歴を表示できるノードを履歴件数付きで返す', async () => {
    const authHeader = await makeAuthHeader();
    const depRows = [
      { source_file: 'src/index.ts', target_file: 'src/utils/jwt.ts' },
      { source_file: 'src/index.ts', target_file: 'src/views/aichat.ts' },
    ];
    const historyRows = [
      { file_path: 'src/index.ts', history_count: 12 },
      { file_path: 'src/views/aichat.ts', history_count: 3 },
    ];
    const res = await app.request(
      '/api/file-deps',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb(depRows, historyRows) }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as {
      historyByNode: Record<string, number>;
    };
    expect(body.historyByNode).toEqual({
      'src/index.ts': 12,
      'src/views/aichat.ts': 3,
    });
  });

  it('履歴判定に失敗しても依存グラフを返し、画面表示用のエラーを通知する', async () => {
    const authHeader = await makeAuthHeader();
    const depRows = [{ source_file: 'src/index.ts', target_file: 'src/utils/jwt.ts' }];
    const res = await app.request(
      '/api/file-deps',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb(depRows, [], true) }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as {
      nodes: string[];
      historyByNode: Record<string, number>;
      historyAvailabilityError: string | null;
    };
    expect(body.nodes).toEqual(['src/index.ts', 'src/utils/jwt.ts']);
    expect(body.historyByNode).toEqual({});
    expect(body.historyAvailabilityError).toBe('履歴の有無を取得できませんでした');
  });
});

describe('GET /file-deps', () => {
  it('ページが200で返る', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/file-deps',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb([]) }
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('ファイル間依存グラフ');
  });

  it('script タグ内のJSに構文エラーがない', () => {
    const html = getFileDepsPage('tester');
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('履歴の有無をノードと凡例で判別でき、履歴なしノードは取得しない', () => {
    const html = getFileDepsPage('tester');
    expect(html).toContain('historyByNode');
    expect(html).toContain('履歴あり');
    expect(html).toContain('履歴なし');
    expect(html).toContain('if (selectedId && historyByNode[selectedId]) loadFileHistory(selectedId)');
  });
});
