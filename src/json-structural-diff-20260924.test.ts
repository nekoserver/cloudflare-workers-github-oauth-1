import { describe, expect, it, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { getJsonStructuralDiffPage } from './views/jsonStructuralDiff';

const JWT_SECRET = 'test-secret';
const createMockDb = () => ({
  prepare: vi.fn().mockImplementation(() => ({
    bind: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue({ revoked_at: null }) }),
  })),
});

describe('GET /json-structural-diff', () => {
  it('認証済みユーザーへWASM対応ページを返す', async () => {
    const token = await createJWT({ sub: 'tester', name: 'Test' }, JWT_SECRET);
    const response = await app.request('/json-structural-diff', { headers: { Authorization: `Bearer ${token}` } }, { JWT_SECRET, DB: createMockDb() });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Security-Policy')).toContain("'wasm-unsafe-eval'");
    expect(await response.text()).toContain('JSON構造差分');
  });

  it('gronで両方を正規化してgo-diffへ渡す', () => {
    const html = getJsonStructuralDiffPage('tester');
    expect(html).toContain("loadGoWasm('/wasm/gron-wasm_exec.js', '/wasm/gron.wasm')");
    expect(html).toContain("loadGoWasm('/wasm/go-diff-wasm_exec.js', '/wasm/go-diff.wasm')");
    expect(html.match(/window\.gronToGron\(/g)).toHaveLength(2);
    expect(html).toContain('window.goDiffText(left, right)');
    expect(html).toContain('window.setTimeout(compare, 300)');
  });

  it('ユーザー名をHTMLエスケープする', () => {
    const html = getJsonStructuralDiffPage('<script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
