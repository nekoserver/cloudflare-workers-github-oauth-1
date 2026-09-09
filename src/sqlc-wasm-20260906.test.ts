/**
 * GET /sqlc-wasm ページ・CSPのテスト
 *
 * 対象: sqlcのクエリアノテーション(`-- name: GetAuthor :one`)パーサーを
 * Go実装(js/wasmビルド、wasm/sqlc-wasm)でブラウザ実行する機能。
 *
 * 故障シナリオ:
 *   (1) /sqlc-wasmのCSPにwasm-unsafe-evalが含まれず、WASM読み込みが
 *       ブラウザ側でブロックされる
 *   (2) CSPの変更が他ページ(/heritage-access)へ波及する
 *   (3) ユーザー名によるXSS
 *   (4) script タグ内のJSに構文エラーがある(テンプレートリテラル内の
 *       エスケープ文字の扱いミス、CLAUDE.mdルール29参照)
 */
import { describe, it, expect, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { getSqlcWasmPage } from './views/sqlcWasm';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function createMockDb() {
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
    })),
  };
}

describe('GET /sqlc-wasm', () => {
  it('CSPのscript-srcにwasm-unsafe-evalが含まれる', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/sqlc-wasm',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb() }
    );
    expect(res.status).toBe(200);
    const csp = res.headers.get('Content-Security-Policy');
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'");
  });

  it('他のページ(/heritage-access)のCSPにはwasm-unsafe-evalが含まれない', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/heritage-access',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb() }
    );
    const csp = res.headers.get('Content-Security-Policy');
    expect(csp).not.toContain('wasm-unsafe-eval');
  });

  it('ページが200で返り、タイトルが含まれる', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/sqlc-wasm',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb() }
    );
    const html = await res.text();
    expect(html).toContain('sqlc クエリアノテーション パーサー');
  });

  it('script タグ内のJSが/wasm/sqlc-wasm_exec.jsをdynamic importする', () => {
    const html = getSqlcWasmPage('tester');
    const scriptRe = /<script type="module">([\s\S]*?)<\/script>/;
    const m = html.match(scriptRe);
    expect(m).not.toBeNull();
    expect(m![1]).toContain("import('/wasm/sqlc-wasm_exec.js')");
    expect(m![1]).toContain('sqlcParseQueryAnnotations');
  });

  it('script タグ内に不正なエスケープシーケンスが含まれない(単引用符エスケープ)', () => {
    const html = getSqlcWasmPage('tester');
    const scriptRe = /<script type="module">([\s\S]*?)<\/script>/;
    const m = html.match(scriptRe);
    expect(m).not.toBeNull();
    expect(m![1]).not.toContain("\\'\\'\\'");
  });

  it('ユーザー名はエスケープされる', () => {
    const html = getSqlcWasmPage('<script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('サンプルSQL内に未エスケープの</textarea>が含まれず、要素を閉じない', () => {
    const html = getSqlcWasmPage('tester');
    const m = html.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/);
    expect(m).not.toBeNull();
    expect(m![1]).not.toContain('</textarea');
  });
});
