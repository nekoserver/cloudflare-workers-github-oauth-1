import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';

// 対象: エリアメニューから「巡回」を選んだ際に左サイドパネルに表示される一覧
// (renderAreaTourSide/startAreaTour が使う kind.getItems())と、
// エリアタブでエリア番号を選んだ際に表示される保存済み項目一覧
// (focusSavedArea が使う AREA_KINDS.map(k => k.getItems())) は、いずれも
// filterInBounds / getStationsInBounds が返す配列を共通で使っているため、
// この2関数の返り値を緯度の高い順(北から順)にソートすることで両方の
// 表示順を一括して修正する。

function extractFunction(html: string, signature: string): string {
  const idx = html.indexOf(signature);
  if (idx < 0) throw new Error(`function not found: ${signature}`);
  let depth = 0;
  let started = false;
  let end = idx;
  for (let i = idx; i < html.length; i++) {
    const ch = html[i];
    if (ch === '{') { depth++; started = true; }
    else if (ch === '}') { depth--; if (started && depth === 0) { end = i + 1; break; } }
  }
  return html.slice(idx, end);
}

describe('世界遺産ページ エリア内一覧(巡回サイドパネル・エリアタブ)の緯度ソート', () => {
  const html = getWebGLHeritagePage('tester');

  it('filterInBoundsは緯度の高い順(北から順)にソートして返す', () => {
    const src = extractFunction(html, 'function filterInBounds(list, getLatLon)');
    const filterInBounds = new Function(
      'lastBoxBounds', 'inAreaScreenBounds',
      `${src}\nreturn filterInBounds;`
    )({ dummy: true }, () => true);
    const list = [
      { name: 'south', lat: 10, lon: 0 },
      { name: 'north', lat: 50, lon: 0 },
      { name: 'middle', lat: 30, lon: 0 },
    ];
    const result = filterInBounds(list, (d: { lat: number; lon: number }) => [d.lat, d.lon]);
    expect(result.map((d: { name: string }) => d.name)).toEqual(['north', 'middle', 'south']);
  });

  it('getStationsInBoundsは緯度の高い駅から順にソートして返す', () => {
    const src = extractFunction(html, 'function getStationsInBounds()');
    const getStationsInBounds = new Function(
      'lastBoxBounds', 'inAreaScreenBounds', 'RAIL_LINES',
      `${src}\nreturn getStationsInBounds;`
    )(
      { dummy: true },
      () => true,
      [{
        flag: '🇯🇵',
        stations: [
          { name: 'south-st', lat: 10, lon: 0 },
          { name: 'north-st', lat: 50, lon: 0 },
          { name: 'middle-st', lat: 30, lon: 0 },
        ],
      }]
    );
    const result = getStationsInBounds();
    expect(result.map((r: { st: { name: string } }) => r.st.name)).toEqual(['north-st', 'middle-st', 'south-st']);
  });
});
