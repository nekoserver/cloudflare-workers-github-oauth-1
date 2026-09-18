/**
 * GET /factor-wasm ページ・CSP、POST /api/aichat の /neko factor 配線の統合テスト
 *
 * 対象: GNU coreutilsのfactorコマンドを模したRust実装(wasm/factor-wasm)を
 * ブラウザ(/factor-wasm)とサーバー(/neko factor)の両方で実行する機能。
 *
 * 故障シナリオ:
 *   (1) /factor-wasmのCSPにwasm-unsafe-evalが含まれず、WASM読み込みが
 *       ブラウザ側でブロックされる
 *   (2) /neko factorがsha256WasmServerと同様のdynamic import配線を欠き、
 *       .wasmの静的importでindex.tsを読み込む既存テストを壊す
 *   (3) /wasm-modulesページでfactorモジュールを無効化しても/neko factorが
 *       そのまま実行できてしまう
 */
import { describe, it, expect, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { getFactorWasmPage } from './views/factorWasm';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function createMockDb(wasmConfigRows: Record<string, unknown>[] = []) {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockImplementation(() => {
          if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
          if (sql.includes('wasm_module_startup_config')) {
            return Promise.resolve(wasmConfigRows[0] ?? null);
          }
          return Promise.resolve(null);
        }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    })),
  };
}

describe('GET /factor-wasm', () => {
  it('CSPのscript-srcにwasm-unsafe-evalが含まれる', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/factor-wasm',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb() }
    );
    expect(res.status).toBe(200);
    const csp = res.headers.get('Content-Security-Policy');
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'");
  });

  it('ページが200で返り、タイトルが含まれる', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/factor-wasm',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb() }
    );
    const html = await res.text();
    expect(html).toContain('素因数分解');
  });

  it('script タグ内のJSに構文エラーがない', () => {
    const html = getFactorWasmPage('tester');
    const scriptRe = /<script type="module">([\s\S]*?)<\/script>/;
    const m = html.match(scriptRe);
    expect(m).not.toBeNull();
    expect(m![1]).toContain("import('/wasm/factor.js')");
  });

  it('ユーザー名はエスケープされる', () => {
    const html = getFactorWasmPage('<script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('POST /api/aichat: /neko factor サーバー配線', () => {
  it('index.ts の /api/aichat が factorViaWasm を渡す（dynamic importで読み込む）', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.post('/api/aichat'");
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 9300);
    expect(fn).toContain('factorViaWasm:');
    expect(fn).toContain("await import('./utils/factorWasmServer')");
  });

  it('factorモジュールが無効化されている場合、/neko factorはエラーメッセージを返し実行しない', async () => {
    const authHeader = await makeAuthHeader();
    const disabledRow = { module_id: 'factor', enabled: 0, updated_at: '2026-08-18 00:00:00', updated_by: 'admin' };
    const res = await app.request(
      '/api/aichat',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '/neko factor 12' }),
      },
      { JWT_SECRET, DB: createMockDb([disabledRow]) }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { response: string };
    expect(body.response).toContain('❌');
    expect(body.response).toContain('/neko factor');
  });
});
