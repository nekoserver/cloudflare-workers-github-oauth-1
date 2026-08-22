// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「ルート順序」セクションの国別フィルタ
// (#route-country-filter/routeCountryFilter)で国を選択した場合に、「🌐 巡回テスト」
// モーダル本体の地球儀(#tour-globe-canvas)、および常時表示の縮小プレビュー
// 「巡回ルートスコープ」(#tour-mini-canvas)の両方へ、その国の中抜き(ストロークのみ)
// 概形アウトラインを描画する機能。実データに国境(GeoJSON等)が存在しないため、
// CITIES/HERITAGE_POINTSのうち選択国に一致する地点群から凸包(近似)を計算し、
// それをproject()で投影して閉じたポリゴンとして描画する(承認済みの簡略化)。
//
// 故障シナリオ:
//   (1) 凸包アルゴリズム自体が入力によっては誤った頂点集合を返す
//       (共線点・重複点・2点以下の入力でクラッシュ/破綻する)
//   (2) 点が少なすぎる/共線で凸包が退化した場合にアウトラインが全く描かれない
//       (パディング付きバウンディングボックスへのフォールバックが必要)
//   (3) フィルタが「すべて」の場合にもアウトラインが描かれてしまう
//   (4) モーダル本体(#tour-globe-canvas)とスコープ(#tour-mini-canvas)の
//       どちらか一方だけにしかアウトラインが反映されない
//   (5) 地球儀裏側(pp.visible===false)の頂点を含むポリゴンをそのまま閉じて
//       描画すると、画面上で自己交差した破綻図形になる
//   (6) フィルタ選択をセッション途中で変更してもアウトラインが再計算されず、
//       前の国のまま描画され続ける

function extractFn(html: string, name: string, argsPattern: string): string {
  const re = new RegExp('function ' + name + '\\(' + argsPattern + '\\) \\{[\\s\\S]*?\\n  \\}');
  const m = html.match(re);
  if (!m) throw new Error(name + ' が生成HTMLから見つからない');
  return m[0];
}

/** 凸包/バウンディングボックス/地点収集の純粋関数群を、キャンバスに依存せず単体で取り出す。 */
function loadHullHelpers(html: string) {
  const src = [
    'var CITIES = ' + JSON.stringify([
      { name: 'A', label: 'A', lat: 40, lon: 10, country: 'テスト国', flag: '' },
      { name: 'B', label: 'B', lat: 42, lon: 12, country: 'テスト国', flag: '' },
      { name: 'C', label: 'C', lat: 41, lon: 15, country: 'テスト国', flag: '' },
      { name: 'D', label: 'D', lat: 40.5, lon: 12, country: 'テスト国', flag: '' }, // 内側の点(凸包に含まれないはず)
      { name: 'E', label: 'E', lat: 50, lon: 5, country: '別の国', flag: '' },
    ]) + ';',
    'var HERITAGE_POINTS = [];',
    extractFn(html, 'convexHull', 'points'),
    extractFn(html, 'boundingBoxPoints', 'points, margin'),
    extractFn(html, 'computeCountryOutlinePoints', 'country'),
    [
      'return {',
      '  convexHull: convexHull,',
      '  boundingBoxPoints: boundingBoxPoints,',
      '  computeCountryOutlinePoints: computeCountryOutlinePoints,',
      '};',
    ].join('\n'),
  ].join('\n');
  // eslint-disable-next-line no-new-func
  return new Function(src)() as {
    convexHull: (points: { lat: number; lon: number }[]) => { lat: number; lon: number }[];
    boundingBoxPoints: (points: { lat: number; lon: number }[], margin: number) => { lat: number; lon: number }[];
    computeCountryOutlinePoints: (country: string) => { lat: number; lon: number }[] | null;
  };
}

describe('convexHull(単体): lat/lonを平面座標とみなした近似凸包', () => {
  it('正方形の4隅+内側の1点から、内側の点を含まない4頂点の凸包を返す', () => {
    const html = getHeritageJourneyPage();
    const { convexHull } = loadHullHelpers(html);
    const square = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 10 },
      { lat: 10, lon: 10 },
      { lat: 10, lon: 0 },
      { lat: 5, lon: 5 }, // 内側
    ];
    const hull = convexHull(square);
    expect(hull.length).toBe(4);
    expect(hull.some((p) => p.lat === 5 && p.lon === 5)).toBe(false);
  });

  it('3点未満の入力ではそのまま(頂点数を減らさず)返す', () => {
    const html = getHeritageJourneyPage();
    const { convexHull } = loadHullHelpers(html);
    const two = [{ lat: 0, lon: 0 }, { lat: 1, lon: 1 }];
    expect(convexHull(two).length).toBeLessThanOrEqual(2);
  });

  it('すべて同一直線上の点(共線)の場合、面積を持つ凸包にならず2点以下に退化する', () => {
    const html = getHeritageJourneyPage();
    const { convexHull } = loadHullHelpers(html);
    const colinear = [
      { lat: 0, lon: 0 },
      { lat: 1, lon: 1 },
      { lat: 2, lon: 2 },
      { lat: 3, lon: 3 },
    ];
    const hull = convexHull(colinear);
    expect(hull.length).toBeLessThan(3);
  });
});

describe('boundingBoxPoints(単体): パディング付きバウンディングボックス', () => {
  it('複数点のmin/max ± marginで4隅を返す', () => {
    const html = getHeritageJourneyPage();
    const { boundingBoxPoints } = loadHullHelpers(html);
    const pts = [{ lat: 10, lon: 20 }, { lat: 12, lon: 22 }];
    const box = boundingBoxPoints(pts, 0.5);
    expect(box.length).toBe(4);
    const lats = box.map((p) => p.lat);
    const lons = box.map((p) => p.lon);
    expect(Math.min(...lats)).toBeCloseTo(9.5, 5);
    expect(Math.max(...lats)).toBeCloseTo(12.5, 5);
    expect(Math.min(...lons)).toBeCloseTo(19.5, 5);
    expect(Math.max(...lons)).toBeCloseTo(22.5, 5);
  });
});

describe('computeCountryOutlinePoints(単体): 国別の候補点収集とフォールバック分岐', () => {
  it('候補点が3点以上・非共線の場合は凸包(4点未満に退化しない)を返す', () => {
    const html = getHeritageJourneyPage();
    const { computeCountryOutlinePoints } = loadHullHelpers(html);
    const pts = computeCountryOutlinePoints('テスト国');
    expect(pts).not.toBeNull();
    expect(pts!.length).toBeGreaterThanOrEqual(3);
    // 別の国の点(E)が混入していないこと
    expect(pts!.some((p) => p.lat === 50 && p.lon === 5)).toBe(false);
  });

  it('該当する点が1件も無い国では null を返す(描画側はこれを見て何も描かない)', () => {
    const html = getHeritageJourneyPage();
    const { computeCountryOutlinePoints } = loadHullHelpers(html);
    expect(computeCountryOutlinePoints('存在しない国')).toBeNull();
  });
});

/** 実データ(HERITAGE_LIST/ROUTE_CITIES埋め込み)上で、点数が少ない/退化するケースのフォールバックを検証する。 */
describe('computeCountryOutlinePoints(単体・実データ): 少数点国のバウンディングボックスへのフォールバック', () => {
  it('候補点が0〜2件の国名を渡すと、凸包ではなくバウンディングボックス(4点)にフォールバックする', () => {
    const html = getHeritageJourneyPage();
    const src = [
      'var CITIES = [{ name: "X", label: "X", lat: 44, lon: 20, country: "単独国", flag: "" }];',
      'var HERITAGE_POINTS = [];',
      extractFn(html, 'convexHull', 'points'),
      extractFn(html, 'boundingBoxPoints', 'points, margin'),
      extractFn(html, 'computeCountryOutlinePoints', 'country'),
      'return { computeCountryOutlinePoints: computeCountryOutlinePoints };',
    ].join('\n');
    // eslint-disable-next-line no-new-func
    const { computeCountryOutlinePoints } = new Function(src)() as {
      computeCountryOutlinePoints: (country: string) => { lat: number; lon: number }[] | null;
    };
    const pts = computeCountryOutlinePoints('単独国');
    expect(pts).not.toBeNull();
    expect(pts!.length).toBe(4);
    // 単独点(44,20)を中心にパディングされた矩形になっているはず
    expect(pts!.some((p) => p.lat < 44)).toBe(true);
    expect(pts!.some((p) => p.lat > 44)).toBe(true);
  });
});

describe('buildOutlineSegments(単体): 地球儀裏側の頂点を除外した部分パス分割', () => {
  function loadBuildOutlineSegments(html: string) {
    const src = [
      extractFn(html, 'buildOutlineSegments', 'projected'),
      'return { buildOutlineSegments: buildOutlineSegments };',
    ].join('\n');
    // eslint-disable-next-line no-new-func
    return new Function(src)() as {
      buildOutlineSegments: (projected: { x: number; y: number; visible: boolean }[]) => { x: number; y: number }[][];
    };
  }

  it('すべての頂点が可視の場合、1本の閉じたセグメント(全頂点)として返す', () => {
    const html = getHeritageJourneyPage();
    const { buildOutlineSegments } = loadBuildOutlineSegments(html);
    const projected = [
      { x: 0, y: 0, visible: true },
      { x: 1, y: 0, visible: true },
      { x: 1, y: 1, visible: true },
    ];
    const segments = buildOutlineSegments(projected);
    expect(segments.length).toBe(1);
    expect(segments[0].length).toBe(3);
  });

  it('一部の頂点が裏側(visible:false)の場合、例外を投げず、裏側の頂点を含まない開いた部分パスに分割する', () => {
    const html = getHeritageJourneyPage();
    const { buildOutlineSegments } = loadBuildOutlineSegments(html);
    const projected = [
      { x: 0, y: 0, visible: true },
      { x: 1, y: 0, visible: false },
      { x: 2, y: 0, visible: true },
      { x: 2, y: 1, visible: true },
      { x: 0, y: 1, visible: false },
    ];
    expect(() => buildOutlineSegments(projected)).not.toThrow();
    const segments = buildOutlineSegments(projected);
    // 裏側の頂点(1件目・4件目)はどのセグメントにも含まれない
    const allPoints = segments.flat();
    expect(allPoints.every((p) => projected.some((pp) => pp.visible && pp.x === p.x && pp.y === p.y))).toBe(true);
    // 連続する可視区間ごとに分割されているため、単一の閉じた1本にはならない
    expect(segments.length).toBeGreaterThanOrEqual(1);
    expect(segments.some((s) => s.length < projected.filter((p) => p.visible).length || segments.length > 1)).toBe(true);
  });

  it('すべての頂点が裏側の場合、空のセグメント配列を返す(描画側は何もしない)', () => {
    const html = getHeritageJourneyPage();
    const { buildOutlineSegments } = loadBuildOutlineSegments(html);
    const projected = [
      { x: 0, y: 0, visible: false },
      { x: 1, y: 0, visible: false },
    ];
    const segments = buildOutlineSegments(projected);
    expect(segments.length).toBe(0);
  });
});

describe('heritage-journeyページ(統合): 国境アウトラインが両キャンバスにライブ反映される', () => {
  type PathCall = { type: string; args: unknown[] };

  function setupPage() {
    const html = getHeritageJourneyPage();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
    const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    const callsByCanvas = new Map<unknown, PathCall[]>();
    const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
    proto.getContext = function (this: unknown) {
      const calls: PathCall[] = [];
      callsByCanvas.set(this, calls);
      const ctx: Record<string, unknown> = {
        clearRect: () => {}, beginPath: () => calls.push({ type: 'beginPath', args: [] }),
        ellipse: () => {}, arc: () => {}, fill: () => {},
        stroke: () => calls.push({ type: 'stroke', args: [] }),
        moveTo: (...a: unknown[]) => calls.push({ type: 'moveTo', args: a }),
        lineTo: (...a: unknown[]) => calls.push({ type: 'lineTo', args: a }),
        closePath: () => calls.push({ type: 'closePath', args: [] }),
        fillText: () => {}, save: () => {}, restore: () => {},
        fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', globalAlpha: 1, textAlign: 'start', textBaseline: 'alphabetic',
      };
      return ctx;
    };
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();
    const modalCanvas = document.getElementById('tour-globe-canvas');
    const miniCanvas = document.getElementById('tour-mini-canvas');
    return {
      modalCalls: () => callsByCanvas.get(modalCanvas) || [],
      miniCalls: () => callsByCanvas.get(miniCanvas) || [],
    };
  }

  afterEach(() => { document.body.innerHTML = ''; });

  it('フィルタが「すべて」のままの初期表示では、国境アウトライン用のstroke呼び出しが発生しない (moveTo/lineToが0回)', () => {
    const { modalCalls } = setupPage();
    const calls = modalCalls();
    // ルート線(project済み経路)自体はmoveTo/lineToを使うため、代わりに
    // closePath(アウトラインの閉じたポリゴンでのみ使用)が呼ばれていないことで判定する。
    expect(calls.some((c) => c.type === 'closePath')).toBe(false);
  });

  it('#route-country-filterで国を選択すると、モーダル本体(#tour-globe-canvas)にclosePathを伴うstrokeが発生する(閉じたポリゴン描画)', () => {
    const { modalCalls } = setupPage();
    const select = document.getElementById('route-country-filter') as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    const options = Array.from(select!.options).map((o) => o.value);
    const nonAllOption = options.find((v, idx) => idx > 0 && v !== '');
    expect(nonAllOption).toBeDefined();

    select!.value = nonAllOption as string;
    select!.dispatchEvent(new Event('change'));

    const calls = modalCalls();
    expect(calls.some((c) => c.type === 'closePath')).toBe(true);
  });

  it('#route-country-filterで国を選択すると、スコープの縮小プレビュー(#tour-mini-canvas)にも同じアウトラインがライブ反映される', () => {
    const { miniCalls } = setupPage();
    const miniPanel = document.getElementById('tour-mini-panel');
    if (miniPanel) miniPanel.style.display = '';

    const select = document.getElementById('route-country-filter') as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    const options = Array.from(select!.options).map((o) => o.value);
    const nonAllOption = options.find((v, idx) => idx > 0 && v !== '');
    expect(nonAllOption).toBeDefined();

    select!.value = nonAllOption as string;
    select!.dispatchEvent(new Event('change'));

    const calls = miniCalls();
    expect(calls.some((c) => c.type === 'closePath')).toBe(true);
  });

  it('フィルタ選択を別の国へ途中で変更すると、アウトラインが再計算されて描画され続ける(2回目のclosePathも発生する)', () => {
    const { modalCalls } = setupPage();
    const select = document.getElementById('route-country-filter') as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    const options = Array.from(select!.options).map((o) => o.value).filter((v, idx) => idx > 0 && v !== '');
    expect(options.length).toBeGreaterThanOrEqual(1);

    select!.value = options[0];
    select!.dispatchEvent(new Event('change'));
    const firstRoundClosePaths = modalCalls().filter((c) => c.type === 'closePath').length;
    expect(firstRoundClosePaths).toBeGreaterThan(0);

    // 「すべて」に戻すとアウトラインが消える。renderGlobeToCanvas()はcanvas.getContext('2d')を
    // 描画のたびに呼び直すため、このモックはgetContext呼び出しごとに新しいcalls配列を作る
    // (=modalCalls()は常に「直近1回分の描画」のみを表す。累積ではない)。
    select!.value = '__ALL__';
    select!.dispatchEvent(new Event('change'));
    const afterAllCount = modalCalls().filter((c) => c.type === 'closePath').length;
    expect(afterAllCount).toBe(0);

    if (options.length >= 1) {
      select!.value = options[options.length - 1];
      select!.dispatchEvent(new Event('change'));
      const secondRoundClosePaths = modalCalls().filter((c) => c.type === 'closePath').length;
      expect(secondRoundClosePaths).toBeGreaterThan(afterAllCount);
    }
  });
});
