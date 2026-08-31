/**
 * GET /ruby-wasm の Content-Security-Policy ヘッダーの検証
 *
 * WebAssembly.instantiate()の実行にはscript-srcへの'wasm-unsafe-eval'が
 * 必要。加えて/ruby-wasmはRubyバイナリ本体をjsDelivr CDNから、
 * JSグルーコード(@ruby/wasm-wasi、bare specifierを解決済みURLへ書き換える
 * ため)をesm.sh経由で取得するため、script-src/connect-srcに
 * https://cdn.jsdelivr.net と https://esm.sh を追加している。
 * /ruby-wasmページのみCSPを上書きし、他ページのCSPは変更しないことを検証する。
 *
 * 故障シナリオ:
 *   (1) /ruby-wasmのCSPにwasm-unsafe-eval・cdn.jsdelivr.net・esm.shの
 *       いずれかが含まれず、WASM読み込みがブラウザ側でブロックされる
 *   (2) /ruby-wasm用のCSP上書きが他のページにも波及し、サイト全体の
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

describe('GET /ruby-wasm', () => {
  it('CSPのscript-src/connect-srcにwasm-unsafe-eval・cdn.jsdelivr.net・esm.shが含まれる', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/ruby-wasm',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb() }
    );
    expect(res.status).toBe(200);
    const csp = res.headers.get('Content-Security-Policy');
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://esm.sh");
    expect(csp).toContain("connect-src 'self' https://cdn.jsdelivr.net https://esm.sh");
  });

  it('他のページ(/heritage-access)のCSPにはwasm-unsafe-eval・jsdelivr・esm.shが含まれない', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/heritage-access',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb() }
    );
    expect(res.status).toBe(200);
    const csp = res.headers.get('Content-Security-Policy');
    expect(csp).not.toContain('wasm-unsafe-eval');
    expect(csp).not.toContain('jsdelivr');
    expect(csp).not.toContain('esm.sh');
  });
});
