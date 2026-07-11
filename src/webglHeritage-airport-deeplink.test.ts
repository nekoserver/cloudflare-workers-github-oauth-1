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

  it('最大ズーム(zoomは値が小さいほど拡大なので下限の1.2)で即座にその座標へ着地する', () => {
    const idx = html.indexOf("sp.get('airport')");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 600);
    // zoomはカメラ距離(trans(view,0,0,-zoom))で、ホイール/ボックスズームは
    // Math.max(1.2, Math.min(10, ...))にクランプされる。1.2が最大ズームイン(拡大)、
    // 10が最大ズームアウト(縮小)なので、"最大ズーム"を狙うなら下限の1.2を使う。
    expect(block).toContain('zoom = 1.2');
    expect(block).not.toContain('zoom = 10');
  });

  // 対象: 深リンク到着時のカメラ移動方式。深リンクは「初期表示」であり
  // 出発地点が無いため、2.5秒(FLY_DUR)の飛行アニメーションは待ち時間でしかない。
  // flyTo()で目標回転角(flyTarget)だけ計算し、即座にrotYv/rotXvへ代入して
  // アニメーションを省略し、ページを開いた直後に空港が表示された状態にする。
  it('深リンクでは飛行アニメーションを省略し、flyToの目標回転角を即座にrotYv/rotXvへ代入する(高速レスポンス)', () => {
    const idx = html.indexOf("sp.get('airport')");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 600);
    expect(block).toContain('flyTo(apt.lat, apt.lon)');
    expect(block).toContain('rotYv = flyTarget.ry');
    expect(block).toContain('rotXv = flyTarget.rx');
    expect(block).toContain('flyTarget = null');
    // 2.5秒待つflyToAirportを深リンクで使っていないこと
    expect(block).not.toContain('flyToAirport(');
    expect(block).toContain('showAptTooltip(apt.code)');
  });

  it('showAptTooltip呼び出し前にsetAirportMarkers(true)で空港マーカーを可視化する(未可視化だとshowAptTooltipが早期returnし何も表示されない)', () => {
    const idx = html.indexOf("sp.get('airport')");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 600);
    expect(block).toContain('setAirportMarkers(true)');
    // setAirportMarkers呼び出しがshowAptTooltip呼び出しより前に来ていること
    expect(block.indexOf('setAirportMarkers(true)')).toBeLessThan(block.indexOf('showAptTooltip('));
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

  // 対象: 深リンク処理の実行タイミング。flyTargetやrotYv等の外側スコープ変数は
  // varのホイスティングにより、setupAirportRoutes()呼び出し中の同期実行だと
  // 未代入(undefined)の可能性がある(過去にFLY_DURがundefinedのまま
  // setTimeout(fn, NaN)となり即発火するバグを実ブラウザ計測で確認済み)。
  // 深リンク処理全体をsetTimeout(fn, 0)で1マクロタスク遅延させ、
  // 同期スクリプト完了後(全var代入後)に実行されるようにする。
  it('深リンク処理はsetTimeout(fn, 0)で1マクロタスク遅延させ、外側スコープのvar代入前に実行されないようにする', () => {
    const idx = html.indexOf("sp.get('airport')");
    expect(idx).toBeGreaterThan(-1);
    const before = html.slice(Math.max(0, idx - 150), idx);
    expect(before).toContain('setTimeout(function() {');
    const tooltipIdx = html.indexOf('showAptTooltip(apt.code)', idx);
    expect(tooltipIdx).toBeGreaterThan(idx);
    const closing = html.slice(tooltipIdx, tooltipIdx + 300);
    expect(closing).toMatch(/\}\s*,\s*0\s*\)\s*;/);
  });
});
