import { describe, expect, it } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';

const html = getWebGLHeritagePage('tester');

describe('世界遺産ページ エリア巡回のズーム反映とアイコン表示', () => {
  it('エリア候補判定前に現在のzoom/回転値をmvpへ反映する', () => {
    expect(html).toContain('function refreshAreaProjectionForCurrentZoom()');
    expect(html).toContain('trans(view, 0, 0, -zoom);');
    expect(html).toMatch(/function filterInBounds\(list, getLatLon\) \{[\s\S]*?refreshAreaProjectionForCurrentZoom\(\);/);
    expect(html).toMatch(/function getStationsInBounds\(\) \{[\s\S]*?refreshAreaProjectionForCurrentZoom\(\);/);
  });

  it('エリア巡回サイドパネルの世界遺産行は地球儀マーカーと同じ個別アイコンを使う', () => {
    expect(html).toContain('itemIcon: function(d) { return d.e; }');
    expect(html).toMatch(/var itemIcon = kind\.itemIcon \? kind\.itemIcon\(item\) : kind\.icon;/);
    expect(html).toContain('<span class="f1-side-flag">\' + itemIcon + \'</span>');
  });
});
