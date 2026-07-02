import { describe, it, expect } from 'vitest';
import { getWebGLFaultsPage } from './views/webglFaults';

describe('活断層・活火山ツールチップの名前に地球儀中心スクロールリンクを張る', () => {
  const html = getWebGLFaultsPage('tester');

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

  it('活断層名(.fault-tt-name)はタップ可能で、タップすると断層の中心座標へflyToLatLonする', () => {
    expect(html).toMatch(/\.fault-tt-name \{[^}]*cursor:pointer;/);
    expect(html).toMatch(/faultNameEl\.onclick = function\(ev\) \{\s*ev\.stopPropagation\(\);\s*flyToLatLon\(f\.center\[0\], f\.center\[1\], 900\);\s*\};/);
  });

  it('活火山名(.vol-tt-name)はタップ可能で、タップすると火山の座標へflyToLatLonする', () => {
    expect(html).toMatch(/\.vol-tt-name \{[^}]*cursor:pointer;/);
    expect(html).toMatch(/volNameEl\.onclick = function\(e\) \{\s*e\.stopPropagation\(\);\s*flyToLatLon\(v\.lat, v\.lon, 900\);\s*\};/);
  });

  it('ドラッグ開始処理は活断層名・活火山名のタップと競合しないよう除外している', () => {
    expect(html).toContain("ev.target.className === 'fault-tt-name'");
    expect(html).toContain("e.target.className === 'vol-tt-name'");
  });

  it('活断層名・活火山名のリンクはアンダーラインなし・文字色は水色(#58a6ff)に統一されている', () => {
    expect(html).toMatch(/\.fault-tt-name \{[^}]*color:#58a6ff;[^}]*text-decoration:none;/);
    expect(html).toMatch(/\.vol-tt-name \{[^}]*color:#58a6ff;[^}]*text-decoration:none;/);
    expect(html).not.toMatch(/\.fault-tt-name:hover \{[^}]*text-decoration:underline/);
    expect(html).not.toMatch(/\.vol-tt-name:hover \{[^}]*text-decoration:underline/);
  });
});
