import { describe, expect, it } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';

const html = getWebGLHeritagePage('tester');

describe('世界遺産ページ エリア巡回候補の枠内判定精度', () => {
  it('巡回候補は緯度経度の範囲だけでなく、投影後のx/y画面座標が選択枠内かも確認する', () => {
    expect(html).toContain('function inAreaScreenBounds(lat, lon, b)');
    expect(html).toContain('screen.x >= screenRect.left');
    expect(html).toContain('screen.x <= screenRect.right');
    expect(html).toContain('screen.y >= screenRect.top');
    expect(html).toContain('screen.y <= screenRect.bottom');
  });

  it('filterInBounds は地理的な粗判定と画面座標の精密判定の両方を満たす候補だけ返す', () => {
    const filterMatch = html.match(/function filterInBounds\(list, getLatLon\) \{[\s\S]*?\n  \}/);
    expect(filterMatch?.[0]).toContain('inAreaBounds(p[0], p[1], b) && inAreaScreenBounds(p[0], p[1], b)');
  });

  it('駅候補の重複除去もx/y画面座標の精密判定後に行う', () => {
    const stationsMatch = html.match(/function getStationsInBounds\(\) \{[\s\S]*?\n  \}/);
    expect(stationsMatch?.[0]).toContain('inAreaBounds(st.lat, st.lon, b) && inAreaScreenBounds(st.lat, st.lon, b)');
  });
});
