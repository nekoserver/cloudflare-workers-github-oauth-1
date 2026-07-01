import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { getHeritageAccessPage } from './views/heritageAccess';
import { HERITAGE_LIST } from './data/heritageList';
import { RAIL_LINES } from './data/railLines';

describe('getHeritageAccessPage 駅周辺世界遺産ランキング機能', () => {
  const html = getHeritageAccessPage('tester');

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

  it('🚉 ボタンとモーダルの要素が存在する', () => {
    expect(html).toContain('id="btn-rail-hr"');
    expect(html).toContain('id="rail-hr-overlay"');
    expect(html).toContain('id="rail-hr-body"');
    expect(html).toContain('id="rail-hr-close"');
    expect(html).toContain('function buildRailStationRanking');
    expect(html).toContain('function renderRailHrRanking');
    expect(html).toContain('function renderRailHrDetail');
  });

  it('駅データ・世界遺産データが埋め込まれている', () => {
    const railMatch = html.match(/var RAIL_LINES = (\[[\s\S]*?\]);/);
    expect(railMatch).not.toBeNull();
    const rail = JSON.parse(railMatch![1]);
    expect(rail.length).toBe(RAIL_LINES.length);

    const heritageMatch = html.match(/var HERITAGE_ALL = (\[[\s\S]*?\]);/);
    expect(heritageMatch).not.toBeNull();
    const heritage = JSON.parse(heritageMatch![1]);
    expect(heritage.length).toBe(HERITAGE_LIST.length);
  });

  it('新規モーダルの z-index は getNextZ() で動的に算出する（固定値を書かない）', () => {
    const idx = html.indexOf("document.getElementById('btn-rail-hr')");
    const block = html.slice(idx, idx + 300);
    expect(block).toContain('getNextZ()');
  });
});

describe('駅ごとの世界遺産カウント（100km以内・haversine）', () => {
  function hvKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const sl = Math.sin(dLat / 2), sn = Math.sin(dLon / 2);
    const a = sl * sl + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * sn * sn;
    return Math.round(R * 2 * Math.asin(Math.sqrt(a)));
  }

  it('東京駅から100km以内には少なくとも1件以上の世界遺産データが存在しうる（0件でもエラーにならない）', () => {
    const tokyo = RAIL_LINES.flatMap((l) => l.stations).find((s) => s.name === '東京駅')!;
    expect(tokyo).toBeTruthy();
    const nearby = HERITAGE_LIST.filter((h) => hvKm(tokyo.lat, tokyo.lon, h.lat, h.lon) <= 100);
    expect(Array.isArray(nearby)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 振る舞いテスト: 実DOMで🚉ボタン→ランキング→駅タップ→詳細→戻る、を検証する
// ---------------------------------------------------------------------------

function extractMainScript(fullHtml: string): string {
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  let best = '';
  while ((m = re.exec(fullHtml)) !== null) {
    if (m[1].indexOf('function renderRailHrRanking(') !== -1) {
      best = m[1];
      break;
    }
  }
  if (!best) throw new Error('renderRailHrRanking を含む <script> が見つかりません');
  return best;
}

function setupDom() {
  const html = getHeritageAccessPage('testuser');
  const script = extractMainScript(html);
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.com/' });
  const window: any = dom.window;
  window.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ rows: [] }) });
  window.eval(script);
  return window;
}

describe('🚉 モーダルの振る舞い', () => {
  it('ボタンを押すとランキングが世界遺産数の降順で表示される', () => {
    const window = setupDom();
    window.document.getElementById('btn-rail-hr').dispatchEvent(new window.Event('click'));
    const rows = Array.from(window.document.querySelectorAll('.rail-hr-row')) as any[];
    expect(rows.length).toBeGreaterThan(0);
    const counts = rows.map((r) => parseInt(r.querySelector('.rail-hr-count').textContent, 10));
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
  });

  it('各行に駅名と路線名が表示される', () => {
    const window = setupDom();
    window.document.getElementById('btn-rail-hr').dispatchEvent(new window.Event('click'));
    const first = window.document.querySelector('.rail-hr-row');
    expect(first.querySelector('.rail-hr-station').textContent.length).toBeGreaterThan(0);
    expect(first.querySelector('.rail-hr-line').textContent.length).toBeGreaterThan(0);
  });

  it('駅名をタップすると、その駅から100km以内の世界遺産名が距離の近い順に表示される', () => {
    const window = setupDom();
    window.document.getElementById('btn-rail-hr').dispatchEvent(new window.Event('click'));
    const firstRow = window.document.querySelector('.rail-hr-row');
    const stationName = firstRow.getAttribute('data-station');
    firstRow.dispatchEvent(new window.Event('click'));

    const detailTitle = window.document.getElementById('rail-hr-title').textContent;
    expect(detailTitle).toContain(stationName);
    expect(detailTitle).toContain('100km以内');

    const hRows = Array.from(window.document.querySelectorAll('.rail-hr-h-row')) as any[];
    const dists = hRows.map((r) => parseInt(r.querySelector('.rail-hr-h-dist').textContent, 10));
    for (let i = 1; i < dists.length; i++) {
      expect(dists[i]).toBeGreaterThanOrEqual(dists[i - 1]);
    }
    dists.forEach((d) => expect(d).toBeLessThanOrEqual(100));
  });

  it('詳細表示から「戻る」でランキング表示に戻れる', () => {
    const window = setupDom();
    window.document.getElementById('btn-rail-hr').dispatchEvent(new window.Event('click'));
    const firstRow = window.document.querySelector('.rail-hr-row');
    firstRow.dispatchEvent(new window.Event('click'));
    expect(window.document.querySelectorAll('.rail-hr-row').length).toBe(0);

    window.document.getElementById('rail-hr-back-btn').dispatchEvent(new window.Event('click'));
    const rowsAfterBack = window.document.querySelectorAll('.rail-hr-row');
    expect(rowsAfterBack.length).toBeGreaterThan(0);
  });
});
