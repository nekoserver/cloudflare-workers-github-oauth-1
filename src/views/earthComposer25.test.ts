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

describe('getEarthComposer25Page: PWA(standalone)向けナビ', () => {
  const html = getEarthComposer25Page('octocat');

  it('画面右上にユーザー名・アバター要素をマークアップに含めない', () => {
    expect(html).not.toContain('user-tag');
    expect(html).not.toContain('user-name');
    expect(html).not.toContain('user-menu-container');
    expect(html).not.toContain('user-icon');
    expect(html).not.toContain('>octocat<');
    expect(html).not.toContain('>tester<');
  });

  it('専用 manifest へ link し、共有 manifest.json は参照しない', () => {
    expect(html).toContain('<link rel="manifest" href="/manifest-earth-composer-2.5.json">');
    expect(html).not.toContain('href="/manifest.json"');
  });

  it('iOS/Android PWA 向け meta タグと Service Worker 登録がある', () => {
    expect(html).toContain('<meta name="mobile-web-app-capable" content="yes">');
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes">');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="earth-composer-2.5">');
    expect(html).toContain("navigator.serviceWorker.register('/sw-earth-composer-2.5.js'");
  });
});

describe('index.ts: /earth-composer-2.5 ルート', () => {
  const indexSrc = fs.readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8');

  it('authMiddleware 付きでルートが登録されている', () => {
    expect(indexSrc).toContain("app.get('/earth-composer-2.5', authMiddleware, async (c) => {");
    expect(indexSrc).toContain('getEarthComposer25Page(user.sub)');
  });
});
