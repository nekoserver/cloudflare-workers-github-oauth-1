import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';

describe('世界遺産ページ エリアズームの枠内判定', () => {
  const html = getWebGLHeritagePage('tester');

  it('枠内判定はズーム後の緯度経度矩形ではなく選択時のスクリーン座標を基準にする', () => {
    const idx = html.indexOf('function filterInBounds(list, getLatLon)');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, html.indexOf('function getHeritagesInBounds()', idx));
    expect(fn).toContain('inAreaScreenBounds(p[0], p[1], b)');
    expect(fn).not.toContain('inAreaBounds(p[0], p[1], b) &&');
  });

  it('鉄道駅の枠内判定も選択時のスクリーン座標に統一されている', () => {
    const idx = html.indexOf('function getStationsInBounds()');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, html.indexOf('function getF1InBounds()', idx));
    expect(fn).toContain('if (inAreaScreenBounds(st.lat, st.lon, b))');
    expect(fn).not.toContain('inAreaBounds(st.lat, st.lon, b) &&');
  });
});
