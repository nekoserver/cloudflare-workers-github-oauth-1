import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getEarthComposer25Page } from './earthComposer25';

describe('getEarthComposer25Page', () => {
  const html = getEarthComposer25Page('tester');

  it('ページタイトルと earth.jpg テクスチャ参照を含む', () => {
    expect(html).toContain('<title>earth-composer-2.5 — WebGL 地球儀</title>');
    expect(html).toContain('earth-composer-2.5');
    expect(html).toContain('earthImg.src = "/earth.jpg"');
  });

  it('ユーザー名をエスケープして表示する', () => {
    const xssHtml = getEarthComposer25Page('<script>alert(1)</script>');
    expect(xssHtml).not.toContain('<script>alert(1)</script>');
    expect(xssHtml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('44px 固定ナビと WebGL シェーダーを含む', () => {
    expect(html).toContain('height: 44px');
    expect(html).toContain('type="x-shader/x-vertex"');
    expect(html).toContain('type="x-shader/x-fragment"');
    expect(html).toContain('getContext("webgl")');
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

describe('index.ts: /earth-composer-2.5 ルート', () => {
  const indexSrc = fs.readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8');

  it('authMiddleware 付きでルートが登録されている', () => {
    expect(indexSrc).toContain("app.get('/earth-composer-2.5', authMiddleware, async (c) => {");
    expect(indexSrc).toContain('getEarthComposer25Page(user.sub)');
  });
});
