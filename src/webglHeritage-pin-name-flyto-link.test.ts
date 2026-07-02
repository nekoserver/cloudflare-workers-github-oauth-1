import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';

describe('駅ツールチップ・F1ツールチップの名前に地球儀中心スクロールリンクを張る', () => {
  const html = getWebGLHeritagePage('tester');

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

  it('駅名(rail-station-pin-name)はタップ可能で、タップするとズーム最大の状態で駅の座標へflyToする', () => {
    expect(html).toMatch(/id="rail-station-pin-name" style="[^"]*pointer-events:auto;cursor:pointer;/);
    expect(html).toMatch(/railStationPinName\.onclick = function\(e\) \{\s*e\.stopPropagation\(\);\s*flyTo\(station\.lat, station\.lon\);\s*zoom = 1\.2;\s*\};/);
  });

  it('F1サーキット名(f1-circuit-pin-name)はタップ可能で、タップするとサーキットの座標へflyToする', () => {
    expect(html).toMatch(/id="f1-circuit-pin-name" style="[^"]*pointer-events:auto;cursor:pointer;/);
    expect(html).toMatch(/f1CircuitPinName\.onclick = function\(e\) \{\s*e\.stopPropagation\(\);\s*flyTo\(race\.lat, race\.lon\);\s*\};/);
  });

  it('駅名・F1サーキット名のリンクはアンダーラインなし・文字色は水色(#58a6ff)に統一されている', () => {
    expect(html).toMatch(/id="rail-station-pin-name" style="[^"]*color:#58a6ff;text-decoration:none;/);
    expect(html).toMatch(/id="f1-circuit-pin-name" style="[^"]*color:#58a6ff;text-decoration:none;/);
  });
});
