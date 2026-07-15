// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: heritage-journeyページの「巡回ルートを再現する」ボタン → webgl-heritageページ。
// sessionStorage経由でルート(出発地→経由地→到着地)を受け渡し、webgl-heritage側で
// 最大ズーム(1.2)で出発点から順にflyToしながら各地点でツールチップの表示時間を
// 確保して停止し、次の地点へ進む巡回を再現する。
// 故障シナリオ:
//   (1) 2つのページでsessionStorageのキー名が食い違い、巡回が一切開始されない
//   (2) 経路上の世界遺産名がHERITAGE配列の名前と完全一致せず、詳細ツールチップが
//       出ずに巡回が止まる/クラッシュする(実際は汎用ツールチップにフォールバックすべき)
//   (3) ツールチップ表示前に次地点へ飛んでしまい、表示時間が確保されない
//   (4) 巡回終了後や✕停止後もタイマーが残り続け、余計なflyTo/tooltipが発火する
//   (5) sessionStorageの不正なJSON/空配列でも例外を投げずに何もしない

function extractFn(html: string, name: string, argsPattern: string): string {
  const re = new RegExp('function ' + name + '\\(' + argsPattern + '\\) \\{[\\s\\S]*?\\n  \\}');
  const m = html.match(re);
  if (!m) throw new Error(name + ' が生成HTMLから見つからない');
  return m[0];
}

function loadJourneyTourFns(html: string) {
  const varsMatch = html.match(/var journeyTourTimer = null[\s\S]*?var JOURNEY_TOUR_DWELL_MS = \d+;/);
  if (!varsMatch) throw new Error('journeyTour用の変数宣言が見つからない');
  const src = [
    varsMatch[0],
    extractFn(html, 'renderJourneyTourProg', ''),
    extractFn(html, 'stopJourneyTour', ''),
    extractFn(html, 'journeyTourStep', ''),
    extractFn(html, 'startJourneyTour', 'points'),
  ].join('\n');

  const flyToCalls: { lat: number; lon: number }[] = [];
  const markerTooltipCalls: { idx: number }[] = [];
  const genericTooltipCalls: string[] = [];
  let hideTooltipCallCount = 0;
  const HERITAGE = [
    { n: 'サンプル世界遺産A', lat: 10, lon: 20 },
    { n: 'サンプル世界遺産B', lat: 30, lon: 40 },
  ];
  const ctx = {
    flyTo: (lat: number, lon: number) => flyToCalls.push({ lat, lon }),
    showMarkerTooltip: (idx: number) => markerTooltipCalls.push({ idx }),
    showGenericAreaTooltip: (html2: string) => genericTooltipCalls.push(html2),
    hideTooltip: () => { hideTooltipCallCount++; },
    escClientHtml: (v: unknown) => String(v ?? ''),
    getNextZ: () => 999,
    HERITAGE,
    FLY_DUR: 2500,
    zoom: 3.2,
  };

  const fn = new Function(
    'ctx',
    `
    var flyTo = ctx.flyTo, showMarkerTooltip = ctx.showMarkerTooltip, showGenericAreaTooltip = ctx.showGenericAreaTooltip,
        hideTooltip = ctx.hideTooltip, escClientHtml = ctx.escClientHtml, getNextZ = ctx.getNextZ,
        HERITAGE = ctx.HERITAGE, FLY_DUR = ctx.FLY_DUR;
    var zoom = ctx.zoom;
    ${src}
    return {
      startJourneyTour: startJourneyTour,
      stopJourneyTour: stopJourneyTour,
      getZoom: function() { return zoom; },
      getRunning: function() { return journeyTourRunning; },
      getProgEl: function() { return journeyTourProgEl; },
    };
    `
  );
  const api = fn(ctx);
  return { api, flyToCalls, markerTooltipCalls, genericTooltipCalls, getHideTooltipCallCount: () => hideTooltipCallCount };
}

describe('journeyTourStep / startJourneyTour / stopJourneyTour', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

  it('開始直後に最初の地点へflyToし、ズームを1.2(最大ズーム)にする', () => {
    const html = getWebGLHeritagePage('tester');
    const { api, flyToCalls } = loadJourneyTourFns(html);
    api.startJourneyTour([
      { name: 'サンプル世界遺産A', lat: 10, lon: 20 },
      { name: 'サンプル世界遺産B', lat: 30, lon: 40 },
    ]);
    expect(flyToCalls).toEqual([{ lat: 10, lon: 20 }]);
    expect(api.getZoom()).toBe(1.2);
  });

  it('FLY_DUR+100ms経過するまではツールチップを表示しない(飛行中に表示時間を消費しない)', () => {
    const html = getWebGLHeritagePage('tester');
    const { api, markerTooltipCalls, genericTooltipCalls } = loadJourneyTourFns(html);
    api.startJourneyTour([{ name: 'サンプル世界遺産A', lat: 10, lon: 20 }]);
    vi.advanceTimersByTime(2500);
    expect(markerTooltipCalls.length).toBe(0);
    expect(genericTooltipCalls.length).toBe(0);
    vi.advanceTimersByTime(101);
    expect(markerTooltipCalls.length + genericTooltipCalls.length).toBe(1);
  });

  it('経路上の名前がHERITAGE配列と一致する場合はshowMarkerTooltipで詳細ツールチップを出す', () => {
    const html = getWebGLHeritagePage('tester');
    const { api, markerTooltipCalls, genericTooltipCalls } = loadJourneyTourFns(html);
    api.startJourneyTour([{ name: 'サンプル世界遺産B', lat: 30, lon: 40 }]);
    vi.advanceTimersByTime(2600);
    expect(markerTooltipCalls).toEqual([{ idx: 1 }]);
    expect(genericTooltipCalls.length).toBe(0);
  });

  it('経路上の名前がHERITAGE配列に無い(都市などの出発/到着地)場合は汎用ツールチップにフォールバックする', () => {
    const html = getWebGLHeritagePage('tester');
    const { api, markerTooltipCalls, genericTooltipCalls } = loadJourneyTourFns(html);
    api.startJourneyTour([{ name: 'パリ', lat: 48.8566, lon: 2.3522 }]);
    vi.advanceTimersByTime(2600);
    expect(markerTooltipCalls.length).toBe(0);
    expect(genericTooltipCalls.length).toBe(1);
    expect(genericTooltipCalls[0]).toContain('パリ');
  });

  it('ツールチップ表示後、停止時間(JOURNEY_TOUR_DWELL_MS=5000ms)を確保してから次の地点へ進む', () => {
    const html = getWebGLHeritagePage('tester');
    const { api, flyToCalls, getHideTooltipCallCount } = loadJourneyTourFns(html);
    api.startJourneyTour([
      { name: 'サンプル世界遺産A', lat: 10, lon: 20 },
      { name: 'サンプル世界遺産B', lat: 30, lon: 40 },
    ]);
    vi.advanceTimersByTime(2600);
    expect(flyToCalls.length).toBe(1);
    vi.advanceTimersByTime(4999);
    expect(flyToCalls.length).toBe(1);
    expect(getHideTooltipCallCount()).toBe(0);
    vi.advanceTimersByTime(2);
    expect(getHideTooltipCallCount()).toBe(1);
    expect(flyToCalls.length).toBe(2);
    expect(flyToCalls[1]).toEqual({ lat: 30, lon: 40 });
  });

  it('最後の地点まで巡回すると自動的に停止する(進捗表示を消し、running状態をfalseにする)', () => {
    const html = getWebGLHeritagePage('tester');
    const { api } = loadJourneyTourFns(html);
    api.startJourneyTour([{ name: 'サンプル世界遺産A', lat: 10, lon: 20 }]);
    expect(api.getRunning()).toBe(true);
    vi.advanceTimersByTime(2600); // flyTo完了→tooltip表示
    vi.advanceTimersByTime(5000); // dwell完了→次地点へ(存在しないので停止)
    expect(api.getRunning()).toBe(false);
    expect(api.getProgEl()).toBeNull();
  });

  it('✕停止(stopJourneyTour)を呼ぶと、以降タイマーが進んでもflyTo/tooltipは発火しない', () => {
    const html = getWebGLHeritagePage('tester');
    const { api, flyToCalls, markerTooltipCalls } = loadJourneyTourFns(html);
    api.startJourneyTour([
      { name: 'サンプル世界遺産A', lat: 10, lon: 20 },
      { name: 'サンプル世界遺産B', lat: 30, lon: 40 },
    ]);
    expect(flyToCalls.length).toBe(1);
    api.stopJourneyTour();
    vi.advanceTimersByTime(20000);
    expect(flyToCalls.length).toBe(1);
    expect(markerTooltipCalls.length).toBe(0);
    expect(api.getRunning()).toBe(false);
  });

  it('進捗表示用のDOM要素をdocument.bodyに追加し、地点名を含むテキストを表示する', () => {
    const html = getWebGLHeritagePage('tester');
    const { api } = loadJourneyTourFns(html);
    api.startJourneyTour([{ name: 'サンプル世界遺産A', lat: 10, lon: 20 }]);
    const el = api.getProgEl();
    expect(el).not.toBeNull();
    expect(document.body.contains(el)).toBe(true);
    expect(el.textContent).toContain('サンプル世界遺産A');
    expect(el.textContent).toContain('1 / 1');
  });
});

describe('heritage-journeyページ: 「巡回ルートを再現する」ボタン', () => {
  it('ボタンが存在し、sessionStorageに経路を保存してから/webgl-heritageへ遷移する', () => {
    const html = getHeritageJourneyPage();
    expect(html).toContain('id="replay-tour-btn"');
    expect(html).toContain("sessionStorage.setItem('heritageJourneyTour'");
    expect(html).toContain("window.location.href = '/webgl-heritage'");
  });

  it('保存する経路は現在計算済みのルート(state.lastOrdered)から作る', () => {
    const html = getHeritageJourneyPage();
    expect(html).toContain('state.lastOrdered');
  });
});

describe('2ページ間のsessionStorageキー・データ契約の整合性', () => {
  it('heritage-journeyとwebgl-heritageで同じsessionStorageキー名(heritageJourneyTour)を使う', () => {
    const journeyHtml = getHeritageJourneyPage();
    const webglHtml = getWebGLHeritagePage('tester');
    expect(journeyHtml).toContain("sessionStorage.setItem('heritageJourneyTour'");
    expect(webglHtml).toContain("sessionStorage.getItem('heritageJourneyTour')");
  });

  it('webgl-heritage側はJSON.parse失敗や空配列でも例外を投げず何もしない(不正データへの防御)', () => {
    const html = getWebGLHeritagePage('tester');
    const m = html.match(/\(function\(\) \{\s*var raw;[\s\S]*?startJourneyTour\(valid\);\s*\}\)\(\);/);
    expect(m).not.toBeNull();
    expect(m![0]).toContain('try { raw = sessionStorage.getItem');
    expect(m![0]).toContain('JSON.parse(raw)');
    expect(m![0]).toContain('if (!valid.length) return;');
  });
});
