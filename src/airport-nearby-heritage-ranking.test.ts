import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');

const routeBlock = (() => {
  const idx = src.indexOf("app.get('/api/airport-nearby-heritage-ranking'");
  return src.slice(idx, idx + 500);
})();

describe('GET /api/airport-nearby-heritage-ranking — 空港周辺の世界遺産数ランキング用データ', () => {
  it('ルートが登録されている', () => {
    expect(routeBlock).not.toBe('');
    expect(src).toContain("app.get('/api/airport-nearby-heritage-ranking'");
  });

  it('airport_nearby_heritage から airport_name・heritage_name・distance_km を取得する', () => {
    expect(routeBlock).toContain('SELECT airport_name, heritage_name, distance_km FROM airport_nearby_heritage');
  });

  it('DBが無い場合は空配列を返す（500エラーにしない）', () => {
    expect(routeBlock).toContain("if (!db) return c.json({ rows: [] });");
  });

  it('レスポンスは rows キーで返す', () => {
    expect(routeBlock).toContain('return c.json({ rows: rows.results });');
  });
});
