/**
 * GET /gron-wasm ページ・CSPのテスト
 *
 * 対象: gron(https://github.com/tomnomnom/gron)のJSON⇔代入文変換ロジックを
 * Go実装(js/wasmビルド、wasm/gron-wasm)でブラウザ実行する機能。
 *
 * 故障シナリオ:
 *   (1) /gron-wasmのCSPにwasm-unsafe-evalが含まれず、WASM読み込みが
 *       ブラウザ側でブロックされる
 *   (2) CSPの変更が他ページ(/heritage-access)へ波及する
 *   (3) ユーザー名によるXSS
 *   (4) script タグ内のJSに構文エラーがある(テンプレートリテラル内の
 *       エスケープ文字の扱いミス、CLAUDE.mdルール29参照)
 */
import { describe, it, expect, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { getGronWasmPage } from './views/gronWasm';

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

describe('GET /gron-wasm', () => {
  it('CSPのscript-srcにwasm-unsafe-evalが含まれる', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/gron-wasm',
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
      '/gron-wasm',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb() }
    );
    const html = await res.text();
    expect(html).toContain('gron / ungron (WASM)');
  });

  it('script タグ内のJSが/wasm/gron-wasm_exec.jsをdynamic importし、両方向の関数を呼ぶ', () => {
    const html = getGronWasmPage('tester');
    const scriptRe = /<script type="module">([\s\S]*?)<\/script>/;
    const m = html.match(scriptRe);
    expect(m).not.toBeNull();
    expect(m![1]).toContain("import('/wasm/gron-wasm_exec.js')");
    expect(m![1]).toContain('window.gronToGron');
    expect(m![1]).toContain('window.gronFromGron');
  });

  it('モード切替ボタンでJSON→gron / gron→JSONを切り替える', () => {
    const html = getGronWasmPage('tester');
    expect(html).toContain('id="modeGron"');
    expect(html).toContain('id="modeUngron"');
    expect(html).toContain("modeGronBtn.addEventListener('click'");
    expect(html).toContain("modeUngronBtn.addEventListener('click'");
  });

  it('入力をデバウンスしてWASM変換結果をライブ更新する', () => {
    const html = getGronWasmPage('tester');
    expect(html).toContain('class="editor-grid"');
    expect(html).toContain("inputText.addEventListener('input'");
    expect(html).toContain('window.setTimeout(parseInput, 250)');
    expect(html).toContain('aria-live="polite"');
  });

  it('script タグ内に不正なエスケープシーケンスが含まれない(単引用符エスケープ)', () => {
    const html = getGronWasmPage('tester');
    const scriptRe = /<script type="module">([\s\S]*?)<\/script>/;
    const m = html.match(scriptRe);
    expect(m).not.toBeNull();
    expect(m![1]).not.toContain("\\'\\'\\'");
  });

  it('サンプルJSON埋め込み文字列がJSとして正しい(改行が実際の改行文字になっている)', () => {
    const html = getGronWasmPage('tester');
    const scriptRe = /<script type="module">([\s\S]*?)<\/script>/;
    const m = html.match(scriptRe);
    expect(m).not.toBeNull();
    expect(m![1]).toContain('var SAMPLE_JSON =');
    // SAMPLE_GRONはjoin('\n')で組み立てる。テンプレートリテラル内で\\nと
    // 書いたものが出力で\n(バックスラッシュ+n)になっていることを確認する
    // (単独の改行文字ではなく、JSソース中のエスケープシーケンスとして残ること)。
    expect(m![1]).toContain("].join('\\n')");
  });

  // ユーザー名・アバターは画面右上から削除済み(2026-09-24、ユーザー依頼)。
  // usernameを画面に一切出力しないこと自体が「エスケープ漏れによるXSS」の
  // 根本対策になるため、意図通り出力されないことを確認する(生の値も
  // エスケープ済みの値もどちらも含まれないことを検証する)。
  it('ユーザー名・アバターは画面に一切表示されない(XSSの入力元ごと削除)', () => {
    const html = getGronWasmPage('<script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('&lt;script&gt;');
    expect(html).not.toContain('class="user-name"');
    expect(html).not.toContain('class="user-icon"');
    expect(html).not.toContain('dropdown-menu');
  });

  it('「今すぐ変換」ボタンは表示されない(自動デバウンス変換とCmd/Ctrl+Enterのみ)', () => {
    const html = getGronWasmPage('tester');
    expect(html).not.toContain('id="parseBtn"');
    expect(html).not.toContain('今すぐ変換');
  });

  it('重複していたページ内タイトル(.title)は表示されない(ナビバーのブランド表記のみ)', () => {
    const html = getGronWasmPage('tester');
    expect(html).not.toContain('class="title"');
  });

  it('モード切替ボタン(JSON→gron / gron→JSON)はエディタの最下段に配置される', () => {
    const html = getGronWasmPage('tester');
    const editorGridIdx = html.indexOf('class="editor-grid"');
    const modeTabsIdx = html.indexOf('class="mode-tabs"');
    expect(editorGridIdx).toBeGreaterThan(-1);
    expect(modeTabsIdx).toBeGreaterThan(editorGridIdx);
  });

  it('サンプルJSON内に未エスケープの</textarea>が含まれず、要素を閉じない', () => {
    const html = getGronWasmPage('tester');
    const m = html.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/);
    expect(m).not.toBeNull();
    expect(m![1]).not.toContain('</textarea');
  });
});
