import { describe, it, expect } from 'vitest';
import { getHeritageAccessPage } from './views/heritageAccess';

// 対象: heritage-areaページの「🛬 空港周辺300km以内の世界遺産数ランキング」モーダル。
// 各行を「国旗」「(空港コード)」「空港名」「国名 都市名」の順で表示し、
// 空港コードは webgl-heritage ページへ ?airport=コード で遷移するリンクにする。
describe('heritage-accessページ: 空港周辺世界遺産ランキングモーダルの書式', () => {
  const html = getHeritageAccessPage('tester');

  it('script タグ内のJSに構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('行アイコンは✈️ではなく🛬を使う', () => {
    const idx = html.indexOf('function renderAirportHrRanking');
    expect(idx).toBeGreaterThan(-1);
    const endIdx = html.indexOf('\ndocument.getElementById(\'btn-airport-hr\')', idx);
    const block = html.slice(idx, endIdx);
    expect(block).toContain('rail-hr-flag">🛬<');
    expect(block).not.toContain('✈️');
  });

  it('空港コードはwebgl-heritageページへ?airport=コードで遷移するリンクになっている', () => {
    expect(html).toContain("function airportLink(code)");
    const idx = html.indexOf('function airportLink');
    const endIdx = html.indexOf('\n}', idx);
    const block = html.slice(idx, endIdx);
    expect(block).toContain("'/webgl-heritage?airport=' + encodeURIComponent(code)");
  });

  it('各行は国旗→(空港コード)→空港名→国名都市名の順で表示する', () => {
    const idx = html.indexOf('function renderAirportHrRanking');
    const endIdx = html.indexOf('\ndocument.getElementById(\'btn-airport-hr\')', idx);
    const block = html.slice(idx, endIdx);
    expect(block).toMatch(/flag[\s\S]*?airportLink\(apt\.code[\s\S]*?r\.airport[\s\S]*?countryCity/);
  });
});
