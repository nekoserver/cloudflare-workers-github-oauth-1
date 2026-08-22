import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

// 対象: GET /api/heritage-journey/registered-starts-for-destination エンドポイント
// (src/index.ts)。#heritage-journeyページの出発地ドロップダウン(#start-city)で、
// ロックされている到着地1件に対し「どの出発地候補が既にheritage_journey_registered_routes
// に登録済みか」を一括判定するために使う。

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');

const routeBlock = (() => {
  const idx = src.indexOf("app.get('/api/heritage-journey/registered-starts-for-destination'");
  expect(idx).toBeGreaterThan(-1);
  return src.slice(idx, idx + 1200);
})();

describe('GET /api/heritage-journey/registered-starts-for-destination', () => {
  it('authMiddlewareで保護されている', () => {
    expect(routeBlock.slice(0, 200)).toContain('authMiddleware');
  });

  it('endクエリパラメータが必須', () => {
    expect(routeBlock).toContain("c.req.query('end')");
    expect(routeBlock).toMatch(/end.*required|required.*end/);
  });

  it('heritage_journey_registered_routesをend_cityで絞り込んでstart_cityを取得する', () => {
    expect(routeBlock).toContain('SELECT start_city FROM heritage_journey_registered_routes WHERE end_city');
  });

  it('DB未接続時はエラーを握りつぶさずstarts:[]とerrorを返す', () => {
    expect(routeBlock).toMatch(/starts:\s*\[\]/);
  });

  it('クエリ失敗時もcatchでエラー内容を記録しつつstarts:[]を返す(握りつぶし禁止)', () => {
    expect(routeBlock).toContain('catch');
    expect(routeBlock).toContain('console.error');
  });
});
