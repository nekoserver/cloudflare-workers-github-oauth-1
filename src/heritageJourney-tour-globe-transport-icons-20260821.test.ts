// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「🌐 巡回テスト」地球儀描画(renderGlobeToCanvas、
// #tour-globe-canvas/#tour-mini-canvas共通)と、経由地1件分の描画を担う
// drawWaypointPoint()。空港・駅の経由地は、世界遺産と同じ薄ピンク色の丸
// (ctx.arc+fill)ではなく、それぞれ「✈︎」「🚉」の絵文字グリフをctx.fillTextで
// 直接描画する。世界遺産の丸描画は従来どおり変更しない。
//
// 故障シナリオ:
//   (1) 空港/駅がtourPointsに変換される際にアイコン種別情報が失われ、
//       renderGlobeToCanvas側で世界遺産と区別できなくなる(syncMiniGlobeの
//       tourPoints組み立てでicon/eフィールドが落ちる)
//   (2) 空港/駅が世界遺産と同じ色丸で描画されてしまう(仕様の未反映)
//   (3) 世界遺産側が退行して丸描画されなくなる、またはグリフ側に巻き込まれる
//   (4) 地球儀裏側(pp.visible===false)の空港/駅グリフが、丸と同様の
//       視覚的な減光処理を一切受けず、表側と全く同じ濃さで描画されてしまう
//   (5) globalAlphaを下げたまま復元し忘れ、以降の描画(現在位置マーカー等)まで
//       薄く描かれてしまう

type FillTextCall = { icon: unknown; x: number; y: number; globalAlpha: number; textAlign: unknown; textBaseline: unknown };
type ArcCall = { x: number; y: number; r: number; fillStyle: unknown };

function setupPage() {
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const arcCalls: ArcCall[] = [];
  const fillTextCalls: FillTextCall[] = [];
  const ctx: Record<string, unknown> = {
    clearRect: () => {}, beginPath: () => {}, ellipse: () => {},
    arc: (x: number, y: number, r: number) => { arcCalls.push({ x, y, r, fillStyle: ctx.fillStyle }); },
    fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
    fillText: (icon: unknown, x: number, y: number) => {
      fillTextCalls.push({
        icon, x, y,
        globalAlpha: ctx.globalAlpha as number,
        textAlign: ctx.textAlign, textBaseline: ctx.textBaseline,
      });
    },
    fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', globalAlpha: 1, textAlign: 'start', textBaseline: 'alphabetic',
  };
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ctx;
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
  return { arcCalls, fillTextCalls };
}

describe('heritage-journeyページ: 地球儀上の空港/駅は色丸ではなく絵文字グリフで描画される(統合)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('既定ルート(Paris→Rome)には空港・駅が含まれ、それぞれ✈︎/🚉のfillTextが呼ばれる', () => {
    const { fillTextCalls } = setupPage();
    const airportCalls = fillTextCalls.filter((c) => c.icon === '✈︎');
    const stationCalls = fillTextCalls.filter((c) => c.icon === '🚉');
    expect(airportCalls.length).toBeGreaterThan(0);
    expect(stationCalls.length).toBeGreaterThan(0);
  });

  it('空港/駅のグリフ位置には、同じ座標でarc(半径5の丸)は描画されない', () => {
    const { arcCalls, fillTextCalls } = setupPage();
    const transportCalls = fillTextCalls.filter((c) => c.icon === '✈︎' || c.icon === '🚉');
    expect(transportCalls.length).toBeGreaterThan(0);
    transportCalls.forEach((tc) => {
      const overlappingArc = arcCalls.find((ac) => ac.r === 5 && Math.abs(ac.x - tc.x) < 0.01 && Math.abs(ac.y - tc.y) < 0.01);
      expect(overlappingArc).toBeUndefined();
    });
  });

  it('世界遺産は空港/駅と同様、カテゴリ絵文字(icon)をfillTextで直接描画する(色丸は使わない)', () => {
    const { arcCalls, fillTextCalls } = setupPage();
    const transportGlyphs = ['✈︎', '🚉'];
    const heritageGlyphCalls = fillTextCalls.filter((c) => {
      const s = String(c.icon);
      return s.length > 0 && !/^\d+$/.test(s) && !transportGlyphs.includes(s);
    });
    expect(heritageGlyphCalls.length).toBeGreaterThan(0);
    // 色丸(半径5)は、iconを持たない経由地(出発地/到着地そのもの)のみで使われる
    // 防御的フォールバックである。tourPointsには出発地(パリ)・到着地(ローマ)自身も
    // 含まれ、これらはicon未設定のため丸で描画される(モーダル本体+スコープの
    // 2キャンバス x 2地点 = 4回)。世界遺産の経由地(icon=カテゴリ絵文字)は
    // 丸を描かない。
    const wpCircleCalls = arcCalls.filter((c) => c.r === 5);
    expect(wpCircleCalls.length).toBe(4);
  });

  it('空港/駅グリフはtextAlign/textBaselineをcenter/middleにして座標を中心に描画する', () => {
    const { fillTextCalls } = setupPage();
    const transportCalls = fillTextCalls.filter((c) => c.icon === '✈︎' || c.icon === '🚉');
    expect(transportCalls.length).toBeGreaterThan(0);
    expect(transportCalls.every((c) => c.textAlign === 'center')).toBe(true);
    expect(transportCalls.every((c) => c.textBaseline === 'middle')).toBe(true);
  });

  it('グリフの直後に描画される通し番号ラベルは、グリフ座標から(+9,-9)ずれた位置に描かれる(同一地点であることの位置整合性)', () => {
    const { fillTextCalls } = setupPage();
    const glyphEntries = fillTextCalls
      .map((c, i) => ({ c, i }))
      .filter((e) => e.c.icon === '✈︎' || e.c.icon === '🚉');
    expect(glyphEntries.length).toBeGreaterThan(0);
    glyphEntries.forEach(({ c, i }) => {
      const label = fillTextCalls[i + 1];
      expect(label).toBeDefined();
      expect(/^\d+$/.test(String(label.icon))).toBe(true);
      expect(label.x).toBeCloseTo(c.x + 9, 5);
      expect(label.y).toBeCloseTo(c.y - 9, 5);
    });
  });

  it('全てのfillText呼び出し後、globalAlphaは1に復元されている(減光の描画後リークがない)', () => {
    const { fillTextCalls } = setupPage();
    // グリフ描画直後(prevAlpha復元後)に描かれる通し番号ラベルはglobalAlpha=1で描かれるはず
    const glyphEntries = fillTextCalls
      .map((c, i) => ({ c, i }))
      .filter((e) => e.c.icon === '✈︎' || e.c.icon === '🚉');
    glyphEntries.forEach(({ i }) => {
      const label = fillTextCalls[i + 1];
      expect(label.globalAlpha).toBe(1);
    });
  });
});

describe('drawWaypointPoint(単体): 経由地1件分の描画分岐(純粋関数として抽出)', () => {
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
      'return { drawWaypointPoint: drawWaypointPoint, AIRPORT: CLIENT_AIRPORT_ICON, STATION: CLIENT_STATION_ICON, setRouteCountryFilter: function(v) { routeCountryFilter = v; } };',
    ].join('\n');
    // eslint-disable-next-line no-new-func
    return new Function(src)() as {
      drawWaypointPoint: (ctx: unknown, pp: { x: number; y: number; visible: boolean }, icon: unknown, i: number, tp?: { country?: string }) => void;
      AIRPORT: string;
      STATION: string;
      setRouteCountryFilter: (v: string) => void;
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

  it('世界遺産(icon=null)は丸+番号ラベルを描画し、fillTextで絵文字グリフは描かない', () => {
    const html = getHeritageJourneyPage();
    const { drawWaypointPoint } = loadDrawWaypointPoint(html);
    const { ctx, calls } = makeCtx();
    drawWaypointPoint(ctx, { x: 10, y: 20, visible: true }, null, 0);
    expect(calls.some((c) => c.type === 'arc')).toBe(true);
    expect(calls.some((c) => c.type === 'fillText' && c.args[0] === '✈︎')).toBe(false);
    expect(calls.some((c) => c.type === 'fillText' && c.args[0] === '🚉')).toBe(false);
  });

  it('空港(AIRPORT_ICON)は丸を描かず✈︎のグリフをfillTextで描画する', () => {
    const html = getHeritageJourneyPage();
    const { drawWaypointPoint, AIRPORT } = loadDrawWaypointPoint(html);
    const { ctx, calls } = makeCtx();
    drawWaypointPoint(ctx, { x: 10, y: 20, visible: true }, AIRPORT, 0);
    expect(calls.some((c) => c.type === 'arc')).toBe(false);
    expect(calls.some((c) => c.type === 'fillText' && c.args[0] === AIRPORT)).toBe(true);
  });

  it('駅(STATION_ICON)は丸を描かず🚉のグリフをfillTextで描画する', () => {
    const html = getHeritageJourneyPage();
    const { drawWaypointPoint, STATION } = loadDrawWaypointPoint(html);
    const { ctx, calls } = makeCtx();
    drawWaypointPoint(ctx, { x: 10, y: 20, visible: true }, STATION, 0);
    expect(calls.some((c) => c.type === 'arc')).toBe(false);
    expect(calls.some((c) => c.type === 'fillText' && c.args[0] === STATION)).toBe(true);
  });

  it('地球儀裏側(visible:false)の空港グリフはglobalAlpha=0.4で描画され、直後に1へ復元される', () => {
    const html = getHeritageJourneyPage();
    const { drawWaypointPoint, AIRPORT } = loadDrawWaypointPoint(html);
    const { ctx, calls } = makeCtx();
    drawWaypointPoint(ctx, { x: 10, y: 20, visible: false }, AIRPORT, 4);
    const glyphCall = calls.find((c) => c.type === 'fillText' && c.args[0] === AIRPORT);
    expect(glyphCall).toBeDefined();
    expect(glyphCall!.globalAlpha).toBe(0.4);
    // グリフ描画呼び出し後、ctx.globalAlphaが元(1)に復元されていること
    expect(ctx.globalAlpha).toBe(1);
  });

  it('地球儀裏側(visible:false)の駅グリフも同様にglobalAlpha=0.4で減光される', () => {
    const html = getHeritageJourneyPage();
    const { drawWaypointPoint, STATION } = loadDrawWaypointPoint(html);
    const { ctx, calls } = makeCtx();
    drawWaypointPoint(ctx, { x: 5, y: 5, visible: false }, STATION, 2);
    const glyphCall = calls.find((c) => c.type === 'fillText' && c.args[0] === STATION);
    expect(glyphCall).toBeDefined();
    expect(glyphCall!.globalAlpha).toBe(0.4);
  });

  it('表側(visible:true)の空港グリフはglobalAlpha=1(減光なし)で描画される', () => {
    const html = getHeritageJourneyPage();
    const { drawWaypointPoint, AIRPORT } = loadDrawWaypointPoint(html);
    const { ctx, calls } = makeCtx();
    drawWaypointPoint(ctx, { x: 10, y: 20, visible: true }, AIRPORT, 1);
    const glyphCall = calls.find((c) => c.type === 'fillText' && c.args[0] === AIRPORT);
    expect(glyphCall!.globalAlpha).toBe(1);
  });

  it('世界遺産の丸は従来どおり、裏側(visible:false)では#475569、表側では#f9a8d4で塗られる(回帰確認)', () => {
    const html = getHeritageJourneyPage();
    const { drawWaypointPoint } = loadDrawWaypointPoint(html);
    const { ctx: ctxVisible, calls: callsVisible } = makeCtx();
    drawWaypointPoint(ctxVisible, { x: 0, y: 0, visible: true }, null, 0);
    expect(callsVisible.find((c) => c.type === 'arc')!.fillStyle).toBe('#f9a8d4');

    const { ctx: ctxHidden, calls: callsHidden } = makeCtx();
    drawWaypointPoint(ctxHidden, { x: 0, y: 0, visible: false }, null, 0);
    expect(callsHidden.find((c) => c.type === 'arc')!.fillStyle).toBe('#475569');
  });
});
