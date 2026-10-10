// 対象: /r9-status ページ(src/views/r9Status.ts の getR9StatusPage)。
// r9.nekomaneki.workへのHMAC署名付きGET結果(src/utils/r9Gateway.ts)を
// そのまま表示する。
//
// 故障シナリオ:
//   (1) r9からの応答本文にHTML特殊文字が含まれていてもエスケープされずXSSになる
//   (2) getThemeToggleScript()が<script>タグの外に置かれ、関数定義が
//       本文にテキストとして表示される(過去に実際発生した不具合、PR #2305/#2308)
//   (3) script構文エラー
//   (4) 未設定・ネットワークエラー時にも何らかの文言を表示せず無言で落ちる
import { describe, it, expect } from 'vitest';
import { getR9StatusPage } from './views/r9Status';
import type { R9StatusResult } from './utils/r9Gateway';

describe('getR9StatusPage: HTML構造', () => {
  it('成功時はステータスコードと本文をそのまま表示する', () => {
    const result: R9StatusResult = { ok: true, status: 200, bodyText: 'r9 is healthy' };
    const html = getR9StatusPage(result);
    expect(html).toContain('200');
    expect(html).toContain('r9 is healthy');
  });

  it('本文にHTML特殊文字があってもエスケープする(XSS対策)', () => {
    const result: R9StatusResult = { ok: true, status: 200, bodyText: '<script>alert(1)</script>' };
    const html = getR9StatusPage(result);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('失敗時はエラー種別と詳細を表示する', () => {
    const result: R9StatusResult = { ok: false, errorCode: 'network_error', detail: 'r9.nekomaneki.workに接続できません: timeout' };
    const html = getR9StatusPage(result);
    expect(html).toContain('timeout');
    expect(html).toContain('r9s-fail');
  });

  it('未設定(R9_HMAC_SECRET無し)の場合専用の案内を表示する', () => {
    const html = getR9StatusPage(null);
    expect(html).toContain('R9_HMAC_SECRET');
  });

  it('toggleThemeの関数定義は<script>タグの中にあり、本文に生テキストとして露出しない', () => {
    const html = getR9StatusPage({ ok: true, status: 200, bodyText: 'ok' });
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
    const html = getR9StatusPage({ ok: true, status: 200, bodyText: 'ok' });
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
    const html = getR9StatusPage({ ok: true, status: 200, bodyText: 'ok' });
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

describe('/r9-status ルート配線', () => {
  it("app.get('/r9-status', ...) がindex.tsに登録されている(authMiddlewareを要求する)", () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.resolve(__dirname, 'index.ts'), 'utf-8');
    expect(src).toContain("app.get('/r9-status', authMiddleware, async (c) => {");
  });
});
