import { describe, expect, it } from 'vitest';
import { getWebGLSolarPage } from './webglSolar';

describe('太陽系ページ 今日の空・自転モードのズームアウト上限', () => {
  it('今日の空と自転では地球の直径が短辺にも入るよう180度超までFOVを広げられる', () => {
    const html = getWebGLSolarPage('test-user');

    expect(html).toContain('var EARTH_DIAMETER_FIT_FOV_MIN = Math.PI;');
    expect(html).toContain('var EARTH_DIAMETER_FIT_FOV_MAX = Math.PI * 1.4;');
    expect(html).toContain('function earthDiameterFitFovMax()');
    expect(html).toMatch(/return \(skyViewMode === 'today' \|\| skyViewMode === 'spin'\) \? earthDiameterFitFovMax\(\) : SKY_FOV_MAX;/);
    expect(html).toContain('fovH = clampSkyFov(fovH + e.deltaY * 0.0015);');
    expect(html).toContain('fovH = clampSkyFov(pinchStartFov * pinchStartDist / d);');
    expect(html).toContain("var backCull = (skyViewMode === 'today' || skyViewMode === 'spin') ? -0.75 : -0.5;");
  });
});
