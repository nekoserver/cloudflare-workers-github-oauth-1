/**
 * GET /equal-earth-map のテスト
 *
 * 対象: イコールアース図法(Equal Earth projection)の白地図ページ。主要都市の
 * メニューをタップすると、その座標を中心に地図がスクロールするギミックを持つ。
 *
 * 故障シナリオ:
 *   (1) 投影後の都市座標が地図のSVG範囲(0〜EQUAL_EARTH_MAP_WIDTH/HEIGHT)からはみ出す
 *   (2) 都市メニューの項目数とSVG上の都市ドット数が一致しない(データの埋め込み漏れ)
 *   (3) 未認証でページが閲覧できてしまう
 *   (4) 生成データの投影式が閉形式の数式と食い違い、y座標の符号(北緯が上)が逆転する
 */
import { describe, it, expect } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import {
  EQUAL_EARTH_MAP_WIDTH,
  EQUAL_EARTH_MAP_HEIGHT,
  EQUAL_EARTH_CITIES,
  EQUAL_EARTH_LAND_PATH_D,
  EQUAL_EARTH_LAKES_PATH_D,
} from './data/equalEarthMapData';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

describe('EQUAL_EARTH_CITIES', () => {
  it('全都市の投影座標が地図のSVG範囲内に収まっている', () => {
    for (const city of EQUAL_EARTH_CITIES) {
      expect(city.x).toBeGreaterThanOrEqual(0);
      expect(city.x).toBeLessThanOrEqual(EQUAL_EARTH_MAP_WIDTH);
      expect(city.y).toBeGreaterThanOrEqual(0);
      expect(city.y).toBeLessThanOrEqual(EQUAL_EARTH_MAP_HEIGHT);
    }
  });

  it('北半球の都市は南半球の都市よりSVG上のy座標が小さい(北ほど上に描画される)', () => {
    const tokyo = EQUAL_EARTH_CITIES.find((c) => c.name === '東京');
    const sydney = EQUAL_EARTH_CITIES.find((c) => c.name === 'シドニー');
    expect(tokyo).toBeDefined();
    expect(sydney).toBeDefined();
    expect(tokyo!.y).toBeLessThan(sydney!.y);
  });

  it('都市データが1件以上存在する', () => {
    expect(EQUAL_EARTH_CITIES.length).toBeGreaterThan(0);
  });
});

describe('EQUAL_EARTH_LAND_PATH_D / EQUAL_EARTH_LAKES_PATH_D', () => {
  it('陸地・湖のパスが空でないSVG path dで構成されている(Natural Earthの実海岸線データ)', () => {
    expect(EQUAL_EARTH_LAND_PATH_D.length).toBeGreaterThan(1000);
    expect(EQUAL_EARTH_LAND_PATH_D.startsWith('M')).toBe(true);
    expect(EQUAL_EARTH_LAKES_PATH_D.length).toBeGreaterThan(0);
    expect(EQUAL_EARTH_LAKES_PATH_D.startsWith('M')).toBe(true);
  });

  it('陸地パスに複数のサブパス(大陸・島)が含まれる', () => {
    const subpathCount = (EQUAL_EARTH_LAND_PATH_D.match(/M/g) ?? []).length;
    expect(subpathCount).toBeGreaterThan(50);
  });
});

describe('GET /equal-earth-map', () => {
  it('都市メニューの項目数とSVG上の都市ドット数が一致する', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request('/equal-earth-map', { headers: { Authorization: authHeader } }, { JWT_SECRET });
    expect(res.status).toBe(200);
    const html = await res.text();
    const menuCount = (html.match(/class="city-menu-item"/g) ?? []).length;
    const dotCount = (html.match(/class="city-dot"/g) ?? []).length;
    expect(menuCount).toBe(EQUAL_EARTH_CITIES.length);
    expect(dotCount).toBe(EQUAL_EARTH_CITIES.length);
  });

  it('SVGのviewBoxが生成済みデータの地図サイズと一致する', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request('/equal-earth-map', { headers: { Authorization: authHeader } }, { JWT_SECRET });
    const html = await res.text();
    expect(html).toContain(`viewBox="0 0 ${EQUAL_EARTH_MAP_WIDTH} ${EQUAL_EARTH_MAP_HEIGHT}"`);
  });

  it('未認証の場合はページを返さない', async () => {
    const res = await app.request('/equal-earth-map', {}, { JWT_SECRET });
    expect(res.status).not.toBe(200);
  });

  it('ズームボタン・全体表示ボタン・ピンチ/ホイール/ドラッグの操作ハンドラが埋め込まれている', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request('/equal-earth-map', { headers: { Authorization: authHeader } }, { JWT_SECRET });
    const html = await res.text();
    expect(html).toContain('id="zoomInBtn"');
    expect(html).toContain('id="zoomOutBtn"');
    expect(html).toContain('id="resetViewBtn"');
    expect(html).toContain("'wheel'");
    expect(html).toContain("addEventListener('pointerdown'");
    expect(html).toContain("addEventListener('pointermove'");
    expect(html).toContain('lastPinchDistance');
  });

  it('オーバーレイのズームボタン上のpointerdownはパン処理をスキップする(ボタンのclickを妨げないため)', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request('/equal-earth-map', { headers: { Authorization: authHeader } }, { JWT_SECRET });
    const html = await res.text();
    expect(html).toContain(".closest('.map-controls')");
  });
});
