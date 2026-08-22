// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「ルート順序」セクションの国別フィルタ
// (#route-country-filter/routeCountryFilter)によるグレーアウトを、「🌐 巡回テスト」
// モーダル本体の地球儀(#tour-globe-canvas)、および常時表示の縮小プレビュー
// 「巡回ルートスコープ」(#tour-mini-panel/#tour-mini-canvas)の両方に反映する
// drawWaypointPoint()の国別減光ロジック。両キャンバスは同一のrenderGlobeToCanvas()/
// drawWaypointPoint()を共有しており、routeCountryFilterというモジュール直下の
// 変数を読むだけで両方に反映される(#tour-globe-canvas/#tour-mini-canvasを
// それぞれtargetCanvasとして呼び分けているだけで描画ロジックは完全に共通)。
//
// 故障シナリオ:
//   (1) tourPoints組み立て(syncMiniGlobe)からcountryフィールドが落ち、
//       drawWaypointPoint側でtp.countryが常にundefinedになり減光判定できない
//   (2) 国別フィルタがROUTE_COUNTRY_FILTER_ALL(すべて)のときに誤って減光してしまう
//   (3) 選択国と一致する地点まで誤って減光してしまう
//   (4) 裏側(pp.visible===false)の減光(0.4)と国別フィルタの減光(0.35)が
//       乗算ではなく上書きになり、両方該当する地点がどちらか一方だけの場合より
//       明るく描画されてしまう(退行)
//   (5) globalAlphaが減光値のまま復元されず、以降の描画(現在位置マーカー等)
//       まで薄く描かれてしまう
//   (6) モーダル本体の地球儀(#tour-globe-canvas)とスコープ(#tour-mini-canvas)の
//       どちらか一方だけにしか国別減光が反映されない(共有関数の呼び分け漏れ)

function loadDrawWaypointPoint(html: string) {
  function extractFn(name: string, argsPattern: string): string {
    const re = new RegExp('function ' + name + '\\(' + argsPattern + '\\) \\{[\\s\\S]*?\\n  \\}');
    const m = html.match(re);
    if (!m) throw new Error(name + ' が生成HTMLから見つからない');
    return m[0];
  }
  const src = [
    "var CLIENT_AIRPORT_ICON = '✈︎';",
    "var CLIENT_STATION_ICON = '🚉';",
    "var ROUTE_COUNTRY_FILTER_ALL = '__ALL__';",
    "var routeCountryFilter = ROUTE_COUNTRY_FILTER_ALL;",
    extractFn('drawWaypointPoint', 'ctx, pp, icon, i, tp'),
    [
      'return {',
      '  drawWaypointPoint: drawWaypointPoint,',
      '  AIRPORT: CLIENT_AIRPORT_ICON,',
      '  STATION: CLIENT_STATION_ICON,',
      '  ALL: ROUTE_COUNTRY_FILTER_ALL,',
      '  setFilter: function(v) { routeCountryFilter = v; }',
      '};',
    ].join('\n'),
  ].join('\n');
  // eslint-disable-next-line no-new-func
  return new Function(src)() as {
    drawWaypointPoint: (
      ctx: unknown,
      pp: { x: number; y: number; visible: boolean },
      icon: unknown,
      i: number,
      tp?: { country?: string },
    ) => void;
    AIRPORT: string;
    STATION: string;
    ALL: string;
    setFilter: (v: string) => void;
  };
}

function makeCtx() {
  const calls: { type: string; args: unknown[]; globalAlpha: number; fillStyle: unknown }[] = [];
  const ctx: Record<string, unknown> = {
    arc: (...args: unknown[]) => calls.push({ type: 'arc', args, globalAlpha: ctx.globalAlpha as number, fillStyle: ctx.fillStyle }),
    fill: () => calls.push({ type: 'fill', args: [], globalAlpha: ctx.globalAlpha as number, fillStyle: ctx.fillStyle }),
    beginPath: () => {},
    fillText: (...args: unknown[]) => calls.push({ type: 'fillText', args, globalAlpha: ctx.globalAlpha as number, fillStyle: ctx.fillStyle }),
    fillStyle: '', font: '', globalAlpha: 1, textAlign: 'start', textBaseline: 'alphabetic',
  };
  return { ctx, calls };
}

describe('drawWaypointPoint(単体): #route-country-filterの選択国に応じた減光', () => {
  it('フィルタが「すべて」の場合、countryが何であっても減光しない(世界遺産の丸)', () => {
    const html = getHeritageJourneyPage();
    const { drawWaypointPoint, ALL, setFilter } = loadDrawWaypointPoint(html);
    setFilter(ALL);
    const { ctx, calls } = makeCtx();
    drawWaypointPoint(ctx, { x: 0, y: 0, visible: true }, null, 0, { country: 'フランス' });
    const arcCall = calls.find((c) => c.type === 'arc');
    expect(arcCall!.globalAlpha).toBe(1);
    expect(ctx.globalAlpha).toBe(1);
  });

  it('選択国と一致しない地点(世界遺産の丸)はglobalAlpha=0.35で減光され、直後に1へ復元される', () => {
    const html = getHeritageJourneyPage();
    const { drawWaypointPoint, setFilter } = loadDrawWaypointPoint(html);
    setFilter('イタリア');
    const { ctx, calls } = makeCtx();
    drawWaypointPoint(ctx, { x: 0, y: 0, visible: true }, null, 0, { country: 'フランス' });
    const arcCall = calls.find((c) => c.type === 'arc');
    expect(arcCall!.globalAlpha).toBeCloseTo(0.35, 5);
    expect(ctx.globalAlpha).toBe(1);
  });

  it('選択国と一致する地点(世界遺産の丸)は通常濃度(globalAlpha=1)で描画される', () => {
    const html = getHeritageJourneyPage();
    const { drawWaypointPoint, setFilter } = loadDrawWaypointPoint(html);
    setFilter('イタリア');
    const { ctx, calls } = makeCtx();
    drawWaypointPoint(ctx, { x: 0, y: 0, visible: true }, null, 0, { country: 'イタリア' });
    const arcCall = calls.find((c) => c.type === 'arc');
    expect(arcCall!.globalAlpha).toBe(1);
  });

  it('選択国と一致しない空港グリフ(✈︎)もglobalAlpha=0.35で減光される', () => {
    const html = getHeritageJourneyPage();
    const { drawWaypointPoint, AIRPORT, setFilter } = loadDrawWaypointPoint(html);
    setFilter('イタリア');
    const { ctx, calls } = makeCtx();
    drawWaypointPoint(ctx, { x: 0, y: 0, visible: true }, AIRPORT, 0, { country: 'フランス' });
    const glyphCall = calls.find((c) => c.type === 'fillText' && c.args[0] === AIRPORT);
    expect(glyphCall!.globalAlpha).toBeCloseTo(0.35, 5);
    expect(ctx.globalAlpha).toBe(1);
  });

  it('tp未指定(country不明)の場合は空文字country扱いとなり、フィルタ選択国と一致しないため減光される(実際の呼び出しではrenderGlobeToCanvasが常にtpを渡すため発生しないケース)', () => {
    const html = getHeritageJourneyPage();
    const { drawWaypointPoint, setFilter } = loadDrawWaypointPoint(html);
    setFilter('イタリア');
    const { ctx, calls } = makeCtx();
    drawWaypointPoint(ctx, { x: 0, y: 0, visible: true }, null, 0);
    const arcCall = calls.find((c) => c.type === 'arc');
    expect(arcCall!.globalAlpha).toBeCloseTo(0.35, 5);
    expect(ctx.globalAlpha).toBe(1);
  });

  it('裏側(visible:false)かつ選択国と不一致の場合、裏側減光(0.4)と国別減光(0.35)が乗算合成され0.14になる(単純上書きではない)', () => {
    const html = getHeritageJourneyPage();
    const { drawWaypointPoint, AIRPORT, setFilter } = loadDrawWaypointPoint(html);
    setFilter('イタリア');
    const { ctx, calls } = makeCtx();
    drawWaypointPoint(ctx, { x: 0, y: 0, visible: false }, AIRPORT, 0, { country: 'フランス' });
    const glyphCall = calls.find((c) => c.type === 'fillText' && c.args[0] === AIRPORT);
    expect(glyphCall!.globalAlpha).toBeCloseTo(0.4 * 0.35, 5);
  });

  it('裏側+国別減光の合成値は、裏側減光のみ・国別減光のみのそれぞれ単体より必ず暗い(以下)', () => {
    const html = getHeritageJourneyPage();
    const { drawWaypointPoint, AIRPORT, ALL, setFilter } = loadDrawWaypointPoint(html);

    setFilter('イタリア');
    const composed = makeCtx();
    drawWaypointPoint(composed.ctx, { x: 0, y: 0, visible: false }, AIRPORT, 0, { country: 'フランス' });
    const composedAlpha = composed.calls.find((c) => c.type === 'fillText' && c.args[0] === AIRPORT)!.globalAlpha;

    setFilter(ALL);
    const backOnly = makeCtx();
    drawWaypointPoint(backOnly.ctx, { x: 0, y: 0, visible: false }, AIRPORT, 0, { country: 'フランス' });
    const backOnlyAlpha = backOnly.calls.find((c) => c.type === 'fillText' && c.args[0] === AIRPORT)!.globalAlpha;

    setFilter('イタリア');
    const countryOnly = makeCtx();
    drawWaypointPoint(countryOnly.ctx, { x: 0, y: 0, visible: true }, AIRPORT, 0, { country: 'フランス' });
    const countryOnlyAlpha = countryOnly.calls.find((c) => c.type === 'fillText' && c.args[0] === AIRPORT)!.globalAlpha;

    expect(composedAlpha).toBeLessThanOrEqual(backOnlyAlpha);
    expect(composedAlpha).toBeLessThanOrEqual(countryOnlyAlpha);
  });
});

describe('heritage-journeyページ(統合): モーダル本体の地球儀とスコープ(縮小プレビュー)の両方に国別フィルタの減光が反映される', () => {
  type FillTextCall = { icon: unknown; globalAlpha: number };
  type ArcCall = { globalAlpha: number };

  function setupPage() {
    const html = getHeritageJourneyPage();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
    const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    const arcCallsByCanvas = new Map<unknown, ArcCall[]>();
    const fillTextCallsByCanvas = new Map<unknown, FillTextCall[]>();
    const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
    proto.getContext = function (this: unknown) {
      const arcCalls: ArcCall[] = [];
      const fillTextCalls: FillTextCall[] = [];
      arcCallsByCanvas.set(this, arcCalls);
      fillTextCallsByCanvas.set(this, fillTextCalls);
      const ctx: Record<string, unknown> = {
        clearRect: () => {}, beginPath: () => {}, ellipse: () => {},
        arc: () => { arcCalls.push({ globalAlpha: ctx.globalAlpha as number }); },
        fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
        fillText: (icon: unknown) => { fillTextCalls.push({ icon, globalAlpha: ctx.globalAlpha as number }); },
        fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', globalAlpha: 1, textAlign: 'start', textBaseline: 'alphabetic',
      };
      return ctx;
    };
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();
    const modalCanvas = document.getElementById('tour-globe-canvas');
    const miniCanvas = document.getElementById('tour-mini-canvas');
    return {
      modalCanvas,
      miniCanvas,
      // getContext()は再描画のたびに新しい配列を積むので、常に「直近の描画」を
      // 読みたい呼び出し側は都度この関数経由で取得する(スナップショットを
      // 保持しない)。
      modalArc: () => arcCallsByCanvas.get(modalCanvas) || [],
      modalFillText: () => fillTextCallsByCanvas.get(modalCanvas) || [],
      miniArc: () => arcCallsByCanvas.get(miniCanvas) || [],
      miniFillText: () => fillTextCallsByCanvas.get(miniCanvas) || [],
    };
  }

  afterEach(() => { document.body.innerHTML = ''; });

  it('国別フィルタ選択前(初期表示)は、モーダル本体・スコープともに丸の描画がglobalAlpha=1のみで行われる', () => {
    const { modalArc, miniArc } = setupPage();
    expect(modalArc().length).toBeGreaterThan(0);
    expect(modalArc().every((c) => c.globalAlpha === 1)).toBe(true);
    if (miniArc().length > 0) {
      expect(miniArc().every((c) => c.globalAlpha === 1)).toBe(true);
    }
  });

  it('#route-country-filterで「すべて」以外を選択すると、モーダル本体の地球儀(#tour-globe-canvas)に減光(globalAlpha<1)描画が即座に発生する(ライブ反映)', () => {
    const { modalArc } = setupPage();
    expect(modalArc().every((c) => c.globalAlpha === 1)).toBe(true);

    const select = document.getElementById('route-country-filter') as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    const options = Array.from(select!.options).map((o) => o.value);
    // 先頭は「すべて(デフォルト)」= ROUTE_COUNTRY_FILTER_ALL のオプションのはずなので、
    // それ以外の実国名オプションを選択する。
    const nonAllOption = options.find((v, idx) => idx > 0 && v !== '');
    expect(nonAllOption).toBeDefined();

    select!.value = nonAllOption as string;
    select!.dispatchEvent(new Event('change'));

    // change イベントのリスナー内で routeCountryFilter が更新され、
    // applyRouteCountryFilter() -> renderAll() -> renderGlobeToCanvas(canvas) が
    // 同期的に呼ばれて#tour-globe-canvasが再描画されているはず。
    const arcCallsAfter = modalArc();
    expect(arcCallsAfter.length).toBeGreaterThan(0);
    expect(arcCallsAfter.some((c) => c.globalAlpha < 1)).toBe(true);
    // フィルタと一致する国の地点まで巻き添えで減光されているわけではないこと
    // (すべての丸が減光されているわけではない = 選択国の地点は通常濃度のまま残る)
    expect(arcCallsAfter.some((c) => c.globalAlpha === 1)).toBe(true);
  });

  it('#route-country-filterで「すべて」以外を選択すると、スコープの縮小プレビュー(#tour-mini-canvas)にも同じ減光がライブ反映される', () => {
    const { miniArc, modalCanvas } = setupPage();
    void modalCanvas;
    // スコープは#tour-mini-panelがdisplay:noneの間はrenderAll()内でスキップされる
    // (miniPanel.style.display !== 'none'の条件)ため、まずスコープを表示状態にする。
    const miniPanel = document.getElementById('tour-mini-panel');
    if (miniPanel) miniPanel.style.display = '';

    const select = document.getElementById('route-country-filter') as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    const options = Array.from(select!.options).map((o) => o.value);
    const nonAllOption = options.find((v, idx) => idx > 0 && v !== '');
    expect(nonAllOption).toBeDefined();

    select!.value = nonAllOption as string;
    select!.dispatchEvent(new Event('change'));

    const arcCallsAfter = miniArc();
    expect(arcCallsAfter.length).toBeGreaterThan(0);
    expect(arcCallsAfter.some((c) => c.globalAlpha < 1)).toBe(true);
  });
});
