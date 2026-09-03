/**
 * GET /gh-attach の Content-Security-Policy ヘッダーの検証
 *
 * WebAssembly.instantiateStreaming()の実行にはscript-srcへの'wasm-unsafe-eval'が
 * 必要(CSPのdefault-src 'self'; script-src 'self' 'unsafe-inline'のままだと
 * 「Refused to create a WebAssembly object because ... 'wasm-unsafe-eval' is
 * not an allowed source」でブロックされる、/sha256-wasm等と同じ制約)。
 * /gh-attachページのみCSPを上書きし、他ページのCSPは変更しないことを検証する。
 *
 * 故障シナリオ:
 *   (1) /gh-attachのCSPにwasm-unsafe-evalが含まれず、WASM読み込みが
 *       ブラウザ側でブロックされる
 *   (2) /gh-attach用のCSP上書きが他のページにも波及し、サイト全体の
 *       CSPが不必要に緩和される
 */
import { describe, it, expect, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function createMockDb() {
  return {
    prepare: vi.fn().mockImplementation(() => ({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ revoked_at: null }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    })),
  };
}

describe('GET /gh-attach', () => {
  it('CSPのscript-srcにwasm-unsafe-evalが含まれる', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/gh-attach',
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
    expect(res.status).toBe(200);
    const csp = res.headers.get('Content-Security-Policy');
    expect(csp).not.toContain('wasm-unsafe-eval');
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
  });
});
