import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';

// 対象: 世界遺産ページの?airport=<空港コード>クエリパラメータによる深リンク。
// heritage-areaページの空港ランキングモーダルから空港コードのリンクで
// このページに遷移した際、最大ズームでその座標へ飛びツールチップを表示する。
describe('世界遺産ページ: ?airport=クエリパラメータによる空港深リンク', () => {
  const html = getWebGLHeritagePage('tester');

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

  it("URLの airport パラメータを読み取りaptByCodeで空港を特定する", () => {
    expect(html).toContain("sp.get('airport')");
    expect(html).toContain('aptByCode[airportCode]');
  });

  it('最大ズーム(10)でその座標へflyToAirportし、到着後にshowAptTooltipを呼ぶ', () => {
    const idx = html.indexOf("sp.get('airport')");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 400);
    expect(block).toContain('zoom = 10');
    expect(block).toContain('flyToAirport(apt.lat, apt.lon, function() { showAptTooltip(apt.code); });');
  });

  it('showAptTooltip呼び出し前にsetAirportMarkers(true)で空港マーカーを可視化する(未可視化だとshowAptTooltipが早期returnし何も表示されない)', () => {
    const idx = html.indexOf("sp.get('airport')");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 400);
    expect(block).toContain('setAirportMarkers(true)');
    // setAirportMarkers呼び出しがflyToAirport(=showAptTooltip呼び出し)より前に来ていること
    expect(block.indexOf('setAirportMarkers(true)')).toBeLessThan(block.indexOf('flyToAirport('));
  });

  it('深リンク処理はsetupAirportRoutes()のスコープ内にある(aptByCode/flyToAirport/setAirportMarkers/showAptTooltipはこの関数のローカル変数のため、外側に置くとReferenceErrorで何も起きない)', () => {
    const fnStart = html.indexOf('function setupAirportRoutes()');
    expect(fnStart).toBeGreaterThan(-1);
    const fnEnd = html.indexOf('\n  setupAirportRoutes();', fnStart);
    expect(fnEnd).toBeGreaterThan(fnStart);
    const airportParamIdx = html.indexOf("sp.get('airport')", fnStart);
    expect(airportParamIdx).toBeGreaterThan(fnStart);
    expect(airportParamIdx).toBeLessThan(fnEnd);
  });
});
