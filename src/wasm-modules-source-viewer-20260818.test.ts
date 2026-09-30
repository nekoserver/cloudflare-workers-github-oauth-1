/**
 * /wasm-modulesページの拡張機能: 各モジュールの最終更新日時・最新ビルド日時、
 * およびソースファイル閲覧API(GET /api/wasm-modules/source)の統合テスト。
 *
 * 対象: GET /api/wasm-modules(sourceUpdatedAt/wasmBuiltAtの付与)、
 * GET /api/wasm-modules/source(GitHub Contents APIからのソース取得)。
 *
 * 故障シナリオ:
 *   (1) GitHubアクセストークンが無いユーザーでGET /api/wasm-modulesを呼ぶと
 *       例外を投げてページ全体が壊れる(nullで返すべき)
 *   (2) 不明なmoduleIdを指定してもソース取得APIが200を返してしまう
 *   (3) GitHubアクセストークンが無い状態でソース取得APIを呼ぶと例外になる
 *       (503で明示的にエラーを返すべき)
 *   (4) GitHub API呼び出し失敗時にソース取得APIが200+空文字を返し、
 *       取得失敗なのか本当に空ファイルなのか呼び出し元が区別できなくなる
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function createMockDb(githubAccessToken: string | null) {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockImplementation(() => {
          if (sql.includes('user_sessions')) {
            if (sql.includes('github_access_token')) {
              return Promise.resolve({
                timezone: 'Asia/Tokyo',
                session_duration: '1h',
                last_login_at: null,
                last_activity_at: null,
                github_access_token: githubAccessToken,
                github_granted_scopes: null,
                recent_commits_count: null,
                toast_duration: null,
                idle_timeout_seconds: null,
              });
            }
            return Promise.resolve({ revoked_at: null });
          }
          return Promise.resolve(null);
        }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    })),
  };
}

describe('GET /api/wasm-modules: sourceUpdatedAt/wasmBuiltAt', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('GitHubアクセストークンが無い場合はsourceUpdatedAt/wasmBuiltAtをnullで返す(例外を投げない)', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/wasm-modules',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb(null) }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { modules: { id: string; sourceUpdatedAt: string | null; wasmBuiltAt: string | null }[] };
    const sha256 = body.modules.find((m) => m.id === 'sha256');
    expect(sha256?.sourceUpdatedAt).toBeNull();
    expect(sha256?.wasmBuiltAt).toBeNull();
  });

  it('GitHubアクセストークンがある場合はGitHub Commits APIから取得した日時を返す', async () => {
    const authHeader = await makeAuthHeader();
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/commits?path=')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ commit: { committer: { date: '2026-08-18T12:00:00Z' } } }]),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const res = await app.request(
      '/api/wasm-modules',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb('gh-token-abc') }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { modules: { id: string; sourceUpdatedAt: string | null; wasmBuiltAt: string | null }[] };
    const sha256 = body.modules.find((m) => m.id === 'sha256');
    expect(sha256?.sourceUpdatedAt).toBe('2026-08-18T12:00:00Z');
    expect(sha256?.wasmBuiltAt).toBe('2026-08-18T12:00:00Z');
  });
});

describe('GET /api/wasm-modules/source', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('不明なmoduleIdは400で拒否される', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/wasm-modules/source?id=unknown-module',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb('gh-token-abc') }
    );
    expect(res.status).toBe(400);
  });

  it('GitHubアクセストークンが無い場合は503を返す', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/wasm-modules/source?id=sha256',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb(null) }
    );
    expect(res.status).toBe(503);
  });

  it('取得に成功すればpath/content/githubUrlを返す', async () => {
    const authHeader = await makeAuthHeader();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('pub fn sha256_hex() {}') });
    vi.stubGlobal('fetch', fetchMock);
    const res = await app.request(
      '/api/wasm-modules/source?id=sha256',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb('gh-token-abc') }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { path: string; content: string; githubUrl: string };
    expect(body.path).toBe('wasm/sha256-wasm/src/lib.rs');
    expect(body.content).toBe('pub fn sha256_hex() {}');
    expect(body.githubUrl).toContain('wasm/sha256-wasm/src/lib.rs');
  });

  it('外部モジュールはそのGitHubリポジトリからソースを取得する', async () => {
    const authHeader = await makeAuthHeader();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('# PicoRuby WASM') });
    vi.stubGlobal('fetch', fetchMock);
    const res = await app.request(
      '/api/wasm-modules/source?id=picoruby',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb('gh-token-abc') }
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/picoruby/wasm/contents/README.md',
      expect.any(Object)
    );
    const body = (await res.json()) as { githubUrl: string };
    expect(body.githubUrl).toBe('https://github.com/picoruby/wasm/blob/main/README.md');
  });

  it('GitHub APIが401(Bad credentials)を返す場合は401と再ログインを促すメッセージを返す(保存されたトークン自体が失効しているケース)', async () => {
    const authHeader = await makeAuthHeader();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ message: 'Bad credentials' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const res = await app.request(
      '/api/wasm-modules/source?id=sha256',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb('gh-token-abc') }
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('401');
    expect(body.error).toContain('Bad credentials');
    expect(body.error).toContain('再度ログイン');
  });

  it('GitHub APIが401以外のエラー(404等)を返す場合は502と実際のステータスコード・エラーメッセージを返す(空文字で握りつぶさない)', async () => {
    const authHeader = await makeAuthHeader();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ message: 'Not Found' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const res = await app.request(
      '/api/wasm-modules/source?id=sha256',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb('gh-token-abc') }
    );
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('404');
    expect(body.error).toContain('Not Found');
  });
});
