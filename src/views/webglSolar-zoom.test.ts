import { describe, expect, it } from 'vitest';
import { getWebGLSolarPage } from './webglSolar';

describe('太陽系ページ 今日の空・自転・地軸固定モードのズームアウト上限', () => {
  it('今日の空・自転・地軸固定では地球の直径が短辺にも入るよう180度超までFOVを広げられる', () => {
    const html = getWebGLSolarPage('test-user');

    expect(html).toContain('var EARTH_DIAMETER_FIT_FOV_MIN = Math.PI;');
    expect(html).toContain('var EARTH_DIAMETER_FIT_FOV_MAX = Math.PI * 1.4;');
    expect(html).toContain('function earthDiameterFitFovMax()');
    // 地軸固定モード(pole)も自転モードと同じく画面全体を見渡す用途のため、
    // 今日の空・自転と同じ広角上限(最大1.4π)の対象に含める。
    expect(html).toMatch(/return \(skyViewMode === 'today' \|\| skyViewMode === 'spin' \|\| skyViewMode === 'pole'\) \? earthDiameterFitFovMax\(\) : SKY_FOV_MAX;/);
    expect(html).toContain('fovH = clampSkyFov(fovH + e.deltaY * 0.0015);');
    expect(html).toContain('fovH = clampSkyFov(pinchStartFov * pinchStartDist / d);');
    // backCullも広角上限と揃えて緩和しないと、広角時に画面周辺の星が
    // 早期にカリングされ消える/ちらつく退行になる。
    expect(html).toContain("var backCull = (skyViewMode === 'today' || skyViewMode === 'spin' || skyViewMode === 'pole') ? -0.75 : -0.5;");
  });
});
