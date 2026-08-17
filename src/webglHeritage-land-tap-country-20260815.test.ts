import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';
import { extractFunctionSource } from './utils/extractFunctionSource';

// 対象: 世界遺産ページ(/webgl-heritage)の「🗺️ 陸地タップ判定」モード。
// 都市統計モーダルから国を選んで開く既存の国別世界遺産パネル(国境ハイライト・
// 塗りつぶし付き)と同じ表示を、地球儀上の陸地を直接タップしても呼び出せるように
// する機能。処理コスト(COUNTRY_BORDERSは約135ヶ国分の多角形)を踏まえ、
// 常時判定はせずボタンでON/OFFできるモードとして実装した。
//
// 故障シナリオ:
//   (1) 点in多角形判定(pointInRing/pointInPolygons)が経度180度をまたぐ国
//       (ロシア等)で誤判定する
//   (2) 海洋部分をタップしても何らかの国がヒットしてしまう(誤検出)
//   (3) モードOFF時にも地球儀タップで国パネルが開いてしまう(既存のドラッグ回転・
//       マーカー選択操作を阻害する)
//   (4) ドラッグ操作(地球儀回転)の直後に発生するclickイベントを陸地タップと
//       誤認識してしまう

// テスト用の簡易多角形データ(実データCOUNTRY_BORDERSではなく、判定ロジックの
// 正しさだけを検証する小さな矩形)。
const TEST_BORDERS = [
  // 日本付近を大まかに囲む矩形(日付変更線をまたがない通常のケース)
  { cc: 'JP', flag: '🇯🇵', polygons: [[[[128, 30], [128, 46], [146, 46], [146, 30], [128, 30]]]] },
  // フィジー周辺を大まかに囲む、経度180度をまたぐ矩形(日付変更線をまたぐケース)
  { cc: 'FJ', flag: '🇫🇯', polygons: [[[[176, -20], [176, -15], [-178, -15], [-178, -20], [176, -20]]]] },
  // 穴あき多角形(ドーナツ状): 外側10x10、内側に4x4の穴
  { cc: 'XX', flag: '🏳️', polygons: [[
    [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]],
    [[4, 4], [4, 6], [6, 6], [6, 4], [4, 4]],
  ]] },
];

function loadGeoFns(html: string) {
  const unwrapSrc = extractFunctionSource(html, 'unwrapRingLons');
  const ringSrc = extractFunctionSource(html, 'pointInRing');
  const polySrc = extractFunctionSource(html, 'pointInPolygons');
  const findSrc = extractFunctionSource(html, 'findCountryAtLatLon');
  expect(unwrapSrc, 'unwrapRingLons が見つからない').toBeTruthy();
  expect(ringSrc, 'pointInRing が見つからない').toBeTruthy();
  expect(polySrc, 'pointInPolygons が見つからない').toBeTruthy();
  expect(findSrc, 'findCountryAtLatLon が見つからない').toBeTruthy();
  const fn = new Function(
    'COUNTRY_BORDERS',
    `${unwrapSrc}\n${ringSrc}\n${polySrc}\n${findSrc}\nreturn { findCountryAtLatLon: findCountryAtLatLon, pointInPolygons: pointInPolygons };`
  );
  return fn(TEST_BORDERS);
}

describe('世界遺産ページ: 陸地タップ判定モードのHTML/UI', () => {
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

  it('陸地タップ判定モードのトグルボタンが存在する', () => {
    expect(html).toContain('id="btnLandTap"');
    expect(html).toContain('🗺️ 陸地タップ判定');
  });

  it('ボタン押下でモードON/OFFを切り替え、textContentとactiveクラスが連動する', () => {
    const idx = html.indexOf("btnLandTap.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 400);
    expect(block).toContain('landTapMode = !landTapMode');
    expect(block).toContain("btnLandTap.classList.toggle('active', landTapMode)");
    expect(block).toContain("landTapMode ? '🗺️ 陸地タップ判定中…' : '🗺️ 陸地タップ判定'");
  });

  it('canvasのclickハンドラはlandTapMode時のみ国判定を行い、boxZoomMode中は行わない', () => {
    const idx = html.indexOf("canvas.addEventListener('click', function(e)");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 600);
    expect(block).toContain('if (landTapMode && !boxZoomMode)');
    expect(block).toContain('findCountryAtLatLon(');
    expect(block).toContain('showCountryHeritagePanel(cc)');
  });

  it('ドラッグ移動量が閾値以上、またはタッチドラッグ後は陸地タップ判定をスキップする', () => {
    const idx = html.indexOf("canvas.addEventListener('click', function(e)");
    const block = html.slice(idx, idx + 600);
    expect(block).toContain('Math.hypot(e.clientX - mouseDownX, e.clientY - mouseDownY)');
    expect(block).toContain('moved < 6 && !touchMoved');
  });
});

describe('世界遺産ページ: 点in多角形判定ロジック(findCountryAtLatLon)', () => {
  const html = getWebGLHeritagePage('tester');

  it('通常の矩形の内側の点はヒットする(日本付近)', () => {
    const { findCountryAtLatLon } = loadGeoFns(html);
    expect(findCountryAtLatLon(35, 137)).toBe('JP');
  });

  it('通常の矩形の外側(海洋想定)の点はヒットしない', () => {
    const { findCountryAtLatLon } = loadGeoFns(html);
    expect(findCountryAtLatLon(0, -60)).toBeNull();
    expect(findCountryAtLatLon(35, 160)).toBeNull();
  });

  it('経度180度をまたぐ多角形でも、またぐ側の点が正しくヒットする(正の経度側)', () => {
    const { findCountryAtLatLon } = loadGeoFns(html);
    expect(findCountryAtLatLon(-17, 178)).toBe('FJ');
  });

  it('経度180度をまたぐ多角形で、またぐ側の点が正しくヒットする(負の経度側)', () => {
    const { findCountryAtLatLon } = loadGeoFns(html);
    expect(findCountryAtLatLon(-17, -179)).toBe('FJ');
  });

  it('経度180度をまたぐ多角形の外側の点はヒットしない', () => {
    const { findCountryAtLatLon } = loadGeoFns(html);
    expect(findCountryAtLatLon(-17, 0)).toBeNull();
  });

  it('穴あき多角形(ドーナツ状)は、穴の外側かつ外形の内側だけヒットする', () => {
    const { pointInPolygons } = loadGeoFns(html);
    var xx = TEST_BORDERS[2].polygons;
    expect(pointInPolygons(2, 2, xx)).toBe(true);
    expect(pointInPolygons(5, 5, xx)).toBe(false);
    expect(pointInPolygons(20, 20, xx)).toBe(false);
  });
});
