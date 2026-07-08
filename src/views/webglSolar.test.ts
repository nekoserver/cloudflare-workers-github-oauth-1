import { describe, it, expect } from 'vitest';
import { getWebGLSolarPage } from './webglSolar';

describe('getWebGLSolarPage', () => {
  const html = getWebGLSolarPage('tester');

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

  it('レグルスの黄道緯度(starLat)が実際の値(約+0.46度)に近い', () => {
    const lonMatch = html.match(/var starLon = \[([^\]]*)\];/);
    const latMatch = html.match(/var starLat = \[([^\]]*)\];/);
    expect(lonMatch).not.toBeNull();
    expect(latMatch).not.toBeNull();

    const lons = lonMatch![1].split(',').map((s) => parseFloat(s.trim()));
    const lats = latMatch![1].split(',').map((s) => parseFloat(s.trim()));

    // namedStars 配列でのレグルスのインデックスは 19 (0始まり)
    const regulusIdx = 19;
    const regulusLatDeg = (lats[regulusIdx] * 180) / Math.PI;
    const regulusLonDeg = (lons[regulusIdx] * 180) / Math.PI;

    // 実際のレグルスの黄道座標: 経度 約149.8度, 緯度 約+0.46度
    expect(regulusLatDeg).toBeGreaterThan(0);
    expect(regulusLatDeg).toBeLessThan(2);
    expect(regulusLonDeg).toBeGreaterThan(145);
    expect(regulusLonDeg).toBeLessThan(155);
  });
});
