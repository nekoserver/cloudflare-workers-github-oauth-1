import { describe, expect, it } from 'vitest';
import { getWebGLSolarPage } from './webglSolar';

describe('太陽系ページ 今日の空・自転モードのズームアウト上限', () => {
  it('今日の空と自転では地球の直径が画面に入る180度までFOVを広げられる', () => {
    const html = getWebGLSolarPage('test-user');

    expect(html).toContain('var EARTH_DIAMETER_FIT_FOV_MAX = Math.PI;');
    expect(html).toMatch(/return \(skyViewMode === 'today' \|\| skyViewMode === 'spin'\) \? EARTH_DIAMETER_FIT_FOV_MAX : SKY_FOV_MAX;/);
    expect(html).toContain('fovH = clampSkyFov(fovH + e.deltaY * 0.0015);');
    expect(html).toContain('fovH = clampSkyFov(pinchStartFov * pinchStartDist / d);');
  });
});
