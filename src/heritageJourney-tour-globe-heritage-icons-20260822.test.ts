// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「🌐 巡回テスト」地球儀描画を担うdrawWaypointPoint()。
// 従来は空港(✈︎)/駅(🚉)のみ絵文字グリフで描画し、世界遺産の経由地は薄ピンク色の丸
// (#f9a8d4)+通し番号ラベルで描画していたが、世界遺産も/webgl-heritageページの地球儀
// (el.textContent = d.e)と同じカテゴリ絵文字(🏰城/🏛️文化/⛪宗教/🌿自然/♨️温泉/🏭産業等)を
// 既にicon(=h.e)として持っているため、種別を問わず絵文字グリフで統一描画する。
//
// 故障シナリオ:
//   (1) 世界遺産のカテゴリ絵文字がfillTextで描画されず、依然として丸描画に落ちてしまう
//   (2) 空港/駅の既存グリフ描画が退行してしまう(iconがtruthy文字列である以上、
//       種別分岐を撤廃しても同じ経路を通るはずだが、念のため回帰確認する)
//   (3) icon未指定/空文字の経由地(データ欠損時の防御的フォールバック)が、
//       グリフ描画に巻き込まれてしまい、丸を描かなくなる
//   (4) 世界遺産の絵文字グリフが、地球儀裏側(pp.visible===false)の減光(globalAlpha=0.4)を
//       受けない、または国別フィルタの減光(0.35)と正しく乗算合成されない
//       (従来この経路は空港/駅icon限定だったため、世界遺産icon側で正しく機能するか検証する)

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

describe('drawWaypointPoint(単体): 世界遺産のカテゴリ絵文字は色丸ではなくfillTextグリフで描画される', () => {
  it('世界遺産の城アイコン(🏰)は丸を描かず、fillTextで🏰をそのまま描画する', () => {
    const html = getHeritageJourneyPage();
    const { drawWaypointPoint } = loadDrawWaypointPoint(html);
    const { ctx, calls } = makeCtx();
    drawWaypointPoint(ctx, { x: 10, y: 20, visible: true }, '🏰', 0);
    expect(calls.some((c) => c.type === 'arc')).toBe(false);
    expect(calls.some((c) => c.type === 'fillText' && c.args[0] === '🏰')).toBe(true);
  });

  it('世界遺産の各カテゴリ絵文字(文化🏛️/宗教⛪/自然🌿/温泉♨️/産業🏭)いずれも丸を描かずfillTextで描画される', () => {
    const html = getHeritageJourneyPage();
    ['🏛️', '⛪', '🌿', '♨️', '🏭'].forEach((glyph) => {
      const { drawWaypointPoint } = loadDrawWaypointPoint(html);
      const { ctx, calls } = makeCtx();
      drawWaypointPoint(ctx, { x: 0, y: 0, visible: true }, glyph, 0);
      expect(calls.some((c) => c.type === 'arc')).toBe(false);
      expect(calls.some((c) => c.type === 'fillText' && c.args[0] === glyph)).toBe(true);
    });
  });

  it('icon未指定(null)/空文字は従来どおり丸+番号ラベルにフォールバックする(防御的デフォルト、回帰確認)', () => {
    const html = getHeritageJourneyPage();
    const { drawWaypointPoint } = loadDrawWaypointPoint(html);

    const nullCase = makeCtx();
    drawWaypointPoint(nullCase.ctx, { x: 0, y: 0, visible: true }, null, 0);
    expect(nullCase.calls.some((c) => c.type === 'arc')).toBe(true);
    expect(nullCase.calls.some((c) => c.type === 'fillText' && typeof c.args[0] === 'string' && c.args[0] !== '' && !/^\d+$/.test(String(c.args[0])))).toBe(false);

    const emptyCase = makeCtx();
    drawWaypointPoint(emptyCase.ctx, { x: 0, y: 0, visible: true }, '', 0);
    expect(emptyCase.calls.some((c) => c.type === 'arc')).toBe(true);
  });

  it('空港(✈︎)/駅(🚉)のグリフ描画は引き続き丸を描かず、退行していない(回帰確認)', () => {
    const html = getHeritageJourneyPage();
    const { drawWaypointPoint, AIRPORT, STATION } = loadDrawWaypointPoint(html);

    const airportCase = makeCtx();
    drawWaypointPoint(airportCase.ctx, { x: 0, y: 0, visible: true }, AIRPORT, 0);
    expect(airportCase.calls.some((c) => c.type === 'arc')).toBe(false);
    expect(airportCase.calls.some((c) => c.type === 'fillText' && c.args[0] === AIRPORT)).toBe(true);

    const stationCase = makeCtx();
    drawWaypointPoint(stationCase.ctx, { x: 0, y: 0, visible: true }, STATION, 0);
    expect(stationCase.calls.some((c) => c.type === 'arc')).toBe(false);
    expect(stationCase.calls.some((c) => c.type === 'fillText' && c.args[0] === STATION)).toBe(true);
  });

  it('地球儀裏側(visible:false)の世界遺産グリフはglobalAlpha=0.4で減光され、直後に1へ復元される', () => {
    const html = getHeritageJourneyPage();
    const { drawWaypointPoint } = loadDrawWaypointPoint(html);
    const { ctx, calls } = makeCtx();
    drawWaypointPoint(ctx, { x: 10, y: 20, visible: false }, '🏰', 4);
    const glyphCall = calls.find((c) => c.type === 'fillText' && c.args[0] === '🏰');
    expect(glyphCall).toBeDefined();
    expect(glyphCall!.globalAlpha).toBe(0.4);
    expect(ctx.globalAlpha).toBe(1);
  });

  it('国別フィルタで選択国と不一致の世界遺産グリフはglobalAlpha=0.35で減光される', () => {
    const html = getHeritageJourneyPage();
    const { drawWaypointPoint, setFilter } = loadDrawWaypointPoint(html);
    setFilter('イタリア');
    const { ctx, calls } = makeCtx();
    drawWaypointPoint(ctx, { x: 0, y: 0, visible: true }, '🏰', 0, { country: 'フランス' });
    const glyphCall = calls.find((c) => c.type === 'fillText' && c.args[0] === '🏰');
    expect(glyphCall!.globalAlpha).toBeCloseTo(0.35, 5);
    expect(ctx.globalAlpha).toBe(1);
  });

  it('裏側+国別フィルタ不一致の世界遺産グリフは0.4*0.35=0.14に乗算合成される(単純上書きではない)', () => {
    const html = getHeritageJourneyPage();
    const { drawWaypointPoint, setFilter } = loadDrawWaypointPoint(html);
    setFilter('イタリア');
    const { ctx, calls } = makeCtx();
    drawWaypointPoint(ctx, { x: 0, y: 0, visible: false }, '🏰', 0, { country: 'フランス' });
    const glyphCall = calls.find((c) => c.type === 'fillText' && c.args[0] === '🏰');
    expect(glyphCall!.globalAlpha).toBeCloseTo(0.4 * 0.35, 5);
  });
});

describe('heritage-journeyページ(統合): 既定ルート(Paris→Rome)の世界遺産経由地はfillTextでカテゴリ絵文字を描画する', () => {
  function setupPage() {
    const html = getHeritageJourneyPage();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
    const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    const arcCalls: { r: number; fillStyle: unknown }[] = [];
    const fillTextCalls: { icon: unknown }[] = [];
    const ctx: Record<string, unknown> = {
      clearRect: () => {}, beginPath: () => {}, ellipse: () => {},
      arc: (x: number, y: number, r: number) => { arcCalls.push({ r, fillStyle: ctx.fillStyle }); },
      fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
      fillText: (icon: unknown) => { fillTextCalls.push({ icon }); },
      fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', globalAlpha: 1, textAlign: 'start', textBaseline: 'alphabetic',
    };
    const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
    proto.getContext = () => ctx;
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();
    return { arcCalls, fillTextCalls };
  }

  it('既定ルートの色丸(r=5)は出発地/到着地自身(icon未設定)の分だけで、世界遺産の経由地では描かれない', () => {
    const { arcCalls } = setupPage();
    // tourPointsには出発地(パリ)・到着地(ローマ)自身も含まれ、iconが無いため
    // 丸描画にフォールバックする(モーダル本体+スコープの2キャンバス x 2地点 = 4回)。
    // これ以上の丸は、icon(カテゴリ絵文字)を持つはずの世界遺産経由地が誤って
    // 丸描画に落ちていることを意味するため許容しない。
    const heritageCircleCalls = arcCalls.filter((c) => c.r === 5 && c.fillStyle === '#f9a8d4');
    expect(heritageCircleCalls.length).toBe(4);
  });

  it('既定ルートには空港/駅グリフ(✈︎/🚉)以外の絵文字グリフ(世界遺産のカテゴリ絵文字)が描画される', () => {
    const { fillTextCalls } = setupPage();
    const otherGlyphs = fillTextCalls.filter((c) => {
      const s = String(c.icon);
      return s.length > 0 && !/^\d+$/.test(s) && s !== '✈︎' && s !== '🚉';
    });
    expect(otherGlyphs.length).toBeGreaterThan(0);
  });
});
