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

  it('選択時点の投影行列と実際のドラッグ枠を保存し、ズーム後のカメラ状態で判定がずれないようにする', () => {
    expect(html).toContain('function copyAreaProjectionState(rect)');
    expect(html).toContain('model: Array.prototype.slice.call(model)');
    expect(html).toContain('mvp: Array.prototype.slice.call(mvp)');
    expect(html).toContain('screenRect: { left: boxLeft, right: boxRight, top: boxTop, bottom: boxBottom }');
    expect(html).toContain('screenState: screenState');
    expect(html).toContain('projectAreaPointToScreen(lat, lon, b.screenState || null)');
  });

  it('投影後座標は canvas の内部ピクセルではなく getBoundingClientRect のCSSピクセルで計算する', () => {
    const projectMatch = html.match(/function projectAreaPointToScreen\(lat, lon, state\) \{[\s\S]*?\n  \}/);
    expect(projectMatch?.[0]).toContain('rect.left + (cx/cw+1)*0.5*rect.width');
    expect(projectMatch?.[0]).toContain('rect.top + (1-cy/cw)*0.5*rect.height');
    expect(projectMatch?.[0]).not.toContain('canvas.width');
    expect(projectMatch?.[0]).not.toContain('canvas.height');
  });

  it('filterInBounds は投影後の画面座標が選択枠内の候補だけ返す', () => {
    const filterMatch = html.match(/function filterInBounds\(list, getLatLon\) \{[\s\S]*?\n  \}/);
    expect(filterMatch?.[0]).toContain('inAreaScreenBounds(p[0], p[1], b)');
  });

  it('駅候補の重複除去もx/y画面座標の精密判定後に行う', () => {
    const stationsMatch = html.match(/function getStationsInBounds\(\) \{[\s\S]*?\n  \}/);
    expect(stationsMatch?.[0]).toContain('inAreaScreenBounds(st.lat, st.lon, b)');
  });
});
