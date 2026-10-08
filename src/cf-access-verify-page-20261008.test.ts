// 対象: /access-verify ページ(src/views/cfAccessVerify.ts の getCfAccessVerifyPage)。
// CloudflareのWARP/Zero Trust Access ならびに Tunnel を経由した正規ユーザーの
// ログインであることを、Access JWTの署名検証・各種設定チェックで証明する。
//
// 故障シナリオ:
//   (1) 診断用ヘッダーやJWTペイロードの値(メールアドレス等)がHTMLエスケープ
//       されずXSSになる
//   (2) getThemeToggleScript()が<script>タグの外に置かれ、関数定義が
//       本文にテキストとして表示される(過去に実際発生した不具合、PR #2305/#2308)
//   (3) script構文エラー
import { describe, it, expect } from 'vitest';
import { getCfAccessVerifyPage } from './views/cfAccessVerify';
import type { AccessVerificationReport } from './utils/cfAccessVerify';

function buildReport(overrides: Partial<AccessVerificationReport> = {}): AccessVerificationReport {
  return {
    overall: 'pass',
    checks: [
      { key: 'jwt_present', label: 'Access JWTの有無', status: 'pass', detail: 'OK' },
    ],
    email: 'user@example.com',
    jwtPayload: { email: 'user@example.com' },
    ...overrides,
  };
}

describe('getCfAccessVerifyPage: HTML構造', () => {
  it('合格/不合格のバッジを正しく表示する', () => {
    const passHtml = getCfAccessVerifyPage(buildReport({ overall: 'pass' }), {});
    expect(passHtml).toContain('cfav-overall-pass');
    const failHtml = getCfAccessVerifyPage(buildReport({ overall: 'fail' }), {});
    expect(failHtml).toContain('cfav-overall-fail');
  });

  it('checksの各ステータス(pass/fail/skipped)をバッジとして表示する', () => {
    const html = getCfAccessVerifyPage(buildReport({
      checks: [
        { key: 'a', label: 'A', status: 'pass', detail: 'd1' },
        { key: 'b', label: 'B', status: 'fail', detail: 'd2' },
        { key: 'c', label: 'C', status: 'skipped', detail: 'd3' },
      ],
    }), {});
    expect(html).toContain('cfav-badge-pass');
    expect(html).toContain('cfav-badge-fail');
    expect(html).toContain('cfav-badge-skipped');
  });

  it('診断用ヘッダーの値にHTML特殊文字があってもエスケープする(XSS対策)', () => {
    const html = getCfAccessVerifyPage(buildReport(), {
      'User-Agent': '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('JWTペイロードの値にHTML特殊文字があってもエスケープする(XSS対策)', () => {
    const html = getCfAccessVerifyPage(buildReport({
      jwtPayload: { email: '<img src=x onerror=alert(1)>' },
    }), {});
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img');
  });

  it('診断用ヘッダーが無い場合は「(無し)」と表示する', () => {
    const html = getCfAccessVerifyPage(buildReport(), { 'Cf-Ray': undefined });
    expect(html).toContain('(無し)');
  });

  // 故障シナリオ(実際に発生した不具合、PR #2305/#2308): getThemeToggleScript()の
  // 出力は<script>タグを自前で持たない生のJSソース文字列であり、既存の
  // <script>...</script>の中に埋め込む前提。これを</script>の外(本文側)に
  // 置くと、関数定義のソースコードがそのままページ本文にテキストとして
  // 表示されてしまう。
  it('toggleThemeの関数定義は<script>タグの中にあり、本文に生テキストとして露出しない', () => {
    const html = getCfAccessVerifyPage(buildReport(), {});
    const lastScriptCloseIdx = html.lastIndexOf('</script>');
    const bodyCloseIdx = html.indexOf('</body>');
    expect(lastScriptCloseIdx).toBeGreaterThan(-1);
    const afterLastScript = html.slice(lastScriptCloseIdx, bodyCloseIdx);
    expect(afterLastScript).not.toContain('function toggleTheme');

    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let found = false;
    let m: RegExpExecArray | null;
    while ((m = scriptRe.exec(html)) !== null) {
      if (m[1].includes('function toggleTheme')) found = true;
    }
    expect(found).toBe(true);
  });

  it('script タグ内の JS に構文エラーがない', () => {
    const html = getCfAccessVerifyPage(buildReport(), {});
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('画面右上に外部ナビリンクを置かない(PWAルール)、ナビバーは44px固定sticky', () => {
    const html = getCfAccessVerifyPage(buildReport(), {});
    const idx = html.indexOf('.navbar {');
    const snippet = html.slice(idx, idx + 250);
    expect(snippet).toContain('height: 44px');
    expect(snippet).toContain('position: sticky');
    const navStart = html.indexOf('<nav class="navbar">');
    const navEnd = html.indexOf('</nav>');
    const navHtml = html.slice(navStart, navEnd);
    expect((navHtml.match(/<a\s/g) || []).length).toBe(0);
  });
});

describe('/access-verify ルート配線', () => {
  it("app.get('/access-verify', ...) がindex.tsに登録されている(authMiddlewareを要求しない)", () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.resolve(__dirname, 'index.ts'), 'utf-8');
    expect(src).toContain("app.get('/access-verify', async (c) => {");
  });
});
