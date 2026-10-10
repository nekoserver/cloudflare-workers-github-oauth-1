// 対象: /bot-auth-verify ページ(src/views/botAuthVerify.ts の getBotAuthVerifyPage)。
// CursorのBot等からのWeb Bot Auth(HTTP Message Signatures)署名付きリクエストを
// 検証した結果(src/utils/webBotAuthVerify.ts)を表示する。
//
// 故障シナリオ:
//   (1) Bot側へ返す値(keyid等)にHTML特殊文字が含まれていてもエスケープされずXSSになる
//   (2) getThemeToggleScript()が<script>タグの外に置かれ、関数定義が
//       本文にテキストとして表示される(過去に実際発生した不具合、PR #2305/#2308)
//   (3) script構文エラー
//   (4) neutral(Signatureヘッダー無し)の場合に不合格と誤表示する
import { describe, it, expect } from 'vitest';
import { getBotAuthVerifyPage } from './views/botAuthVerify';
import type { WebBotAuthVerifyResult } from './utils/webBotAuthVerify';

describe('getBotAuthVerifyPage: HTML構造', () => {
  it('validの場合は合格バッジとkeyid・algorithmを表示する', () => {
    const result: WebBotAuthVerifyResult = {
      status: 'valid', keyid: 'abc123', algorithm: 'ed25519',
      signatureAgentUri: 'https://bot.example/.well-known/http-message-signatures-directory',
      created: new Date('2026-10-10T00:00:00Z'), expires: new Date('2026-10-10T00:05:00Z'),
    };
    const html = getBotAuthVerifyPage(result);
    expect(html).toContain('bav-overall-valid');
    expect(html).toContain('abc123');
    expect(html).toContain('ed25519');
  });

  it('invalidの場合は不合格バッジと理由を表示する', () => {
    const result: WebBotAuthVerifyResult = { status: 'invalid', detail: 'signature mismatch' };
    const html = getBotAuthVerifyPage(result);
    expect(html).toContain('bav-overall-invalid');
    expect(html).toContain('signature mismatch');
  });

  it('neutral(Signatureヘッダー無し)の場合は不合格ではなく専用の案内を表示する', () => {
    const result: WebBotAuthVerifyResult = { status: 'neutral' };
    const html = getBotAuthVerifyPage(result);
    expect(html).toContain('class="bav-overall bav-overall-neutral"');
    expect(html).not.toContain('class="bav-overall bav-overall-invalid"');
  });

  it('keyidや理由にHTML特殊文字があってもエスケープする(XSS対策)', () => {
    const result: WebBotAuthVerifyResult = { status: 'invalid', detail: '<script>alert(1)</script>' };
    const html = getBotAuthVerifyPage(result);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('toggleThemeの関数定義は<script>タグの中にあり、本文に生テキストとして露出しない', () => {
    const html = getBotAuthVerifyPage({ status: 'neutral' });
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
    const html = getBotAuthVerifyPage({ status: 'neutral' });
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
    const html = getBotAuthVerifyPage({ status: 'neutral' });
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

describe('/bot-auth-verify ルート配線', () => {
  it("app.all('/bot-auth-verify', ...) がindex.tsに登録されている(authMiddlewareを要求しない)", () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.resolve(__dirname, 'index.ts'), 'utf-8');
    expect(src).toContain("app.all('/bot-auth-verify', async (c) => {");
  });
});
