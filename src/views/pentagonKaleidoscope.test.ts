import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getPentagonKaleidoscopePage } from './pentagonKaleidoscope';

describe('getPentagonKaleidoscopePage', () => {
  const html = getPentagonKaleidoscopePage('tester');

  it('ページタイトルと万華鏡 canvas を含む', () => {
    expect(html).toContain('<title>pentagon-kaleidoscope — 五角形万華鏡</title>');
    expect(html).toContain('id="kal"');
    expect(html).toContain("getContext('2d')");
  });

  it('主要な操作 UI（対称数・速度・残像・ボタン）が存在する', () => {
    expect(html).toContain('id="segments"');
    expect(html).toContain('id="speed"');
    expect(html).toContain('id="trail"');
    expect(html).toContain('id="pauseBtn"');
    expect(html).toContain('id="mirrorBtn"');
    expect(html).toContain('id="hud"');
  });

  it('対称数の初期値が 5（五角形）である', () => {
    expect(html).toContain('value="5"');
    expect(html).toContain('var segments = 5;');
  });

  it('44px 固定ナビを含む', () => {
    expect(html).toContain('height: 44px');
    expect(html).toContain('position: sticky');
  });

  it('ユーザー名をエスケープして表示する', () => {
    const xssHtml = getPentagonKaleidoscopePage('<script>alert(1)</script>');
    expect(xssHtml).not.toContain('<span class="user-tag"><script>alert(1)</script>');
    expect(xssHtml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('script タグ内の JS に構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });
});

describe('index.ts: /pentagon-kaleidoscope ルート', () => {
  const indexSrc = fs.readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8');

  it('authMiddleware 付きでルートが登録されている', () => {
    expect(indexSrc).toContain("app.get('/pentagon-kaleidoscope', authMiddleware, async (c) => {");
    expect(indexSrc).toContain('getPentagonKaleidoscopePage(user.sub)');
  });
});
