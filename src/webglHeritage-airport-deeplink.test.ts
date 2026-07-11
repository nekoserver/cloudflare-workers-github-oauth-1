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

  it('最大ズーム(zoomは値が小さいほど拡大なので下限の1.2)でその座標へflyToAirportし、到着後にshowAptTooltipを呼ぶ', () => {
    const idx = html.indexOf("sp.get('airport')");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 400);
    // zoomはカメラ距離(trans(view,0,0,-zoom))で、ホイール/ボックスズームは
    // Math.max(1.2, Math.min(10, ...))にクランプされる。1.2が最大ズームイン(拡大)、
    // 10が最大ズームアウト(縮小)なので、"最大ズーム"を狙うなら下限の1.2を使う。
    expect(block).toContain('zoom = 1.2');
    expect(block).not.toContain('zoom = 10');
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

  // 対象: flyToAirport内部の setTimeout(fn, FLY_DUR + 100) が使う FLY_DUR。
  // FLY_DUR は setupAirportRoutes() の外側(スクリプト後方)で
  // `var FLY_DUR = 2500;` と宣言されており、varのホイスティングにより
  // 深リンク処理が setupAirportRoutes() 呼び出し中に同期実行されると
  // FLY_DUR はまだ undefined で、setTimeout(fn, NaN) になり
  // ほぼ即座に(カメラが飛ぶ前に)コールバックが発火してしまう。
  // これを実ブラウザ(Playwright)のsetTimeout計測で検出したため、
  // 深リンク処理全体を setTimeout(fn, 0) で1マクロタスク遅延させ、
  // 同期スクリプト完了後(=FLY_DUR代入後)に実行されるようにした。
  it('深リンク処理はsetTimeout(fn, 0)で1マクロタスク遅延させ、FLY_DUR代入前に実行されないようにする', () => {
    const idx = html.indexOf("sp.get('airport')");
    expect(idx).toBeGreaterThan(-1);
    const before = html.slice(Math.max(0, idx - 150), idx);
    expect(before).toContain('setTimeout(function() {');
    const afterFlyToAirportIdx = html.indexOf('flyToAirport(apt.lat, apt.lon', idx);
    expect(afterFlyToAirportIdx).toBeGreaterThan(idx);
    const closing = html.slice(afterFlyToAirportIdx, afterFlyToAirportIdx + 200);
    expect(closing).toMatch(/\}\s*,\s*0\s*\)\s*;/);
  });

  it('FLY_DURの宣言(var FLY_DUR = 2500;)より前にflyToAirportを同期呼び出ししていない(深リンクIIFEが直接呼ぶ形に戻すとNaN setTimeoutバグが再発する)', () => {
    const idx = html.indexOf("sp.get('airport')");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 400);
    // (function() { ... })(); という即時同期呼び出しの形になっていないこと
    expect(block).not.toMatch(/^\s*[\s\S]*\}\)\(\);/);
  });
});
