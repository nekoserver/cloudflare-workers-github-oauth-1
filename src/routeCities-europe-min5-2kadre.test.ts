import { describe, it, expect } from 'vitest';
import { ROUTE_CITIES } from './data/routeCities';

const LAT_MIN = 34, LAT_MAX = 71, LON_MIN = -25, LON_MAX = 45;
const MIN_PER_COUNTRY = 5;

describe('ROUTE_CITIES データ整合性(欧州拡張 2kadre)', () => {
  it('name に重複が無い', () => {
    const names = ROUTE_CITIES.map((c) => c.name);
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    expect([...new Set(dup)]).toEqual([]);
  });

  it('(lat, lon) の組に重複が無い', () => {
    const coords = ROUTE_CITIES.map((c) => `${c.lat},${c.lon}`);
    const dup = coords.filter((c, i) => coords.indexOf(c) !== i);
    expect([...new Set(dup)]).toEqual([]);
  });

  it('flag/country が非空文字列で、lat/lon が欧州近傍の緩い範囲に収まる', () => {
    for (const c of ROUTE_CITIES) {
      expect(typeof c.flag).toBe('string');
      expect(c.flag.length).toBeGreaterThan(0);
      expect(typeof c.country).toBe('string');
      expect(c.country.length).toBeGreaterThan(0);
      expect(c.lat).toBeGreaterThanOrEqual(LAT_MIN);
      expect(c.lat).toBeLessThanOrEqual(LAT_MAX);
      expect(c.lon).toBeGreaterThanOrEqual(LON_MIN);
      expect(c.lon).toBeLessThanOrEqual(LON_MAX);
    }
  });

  it('country ごとに最低5件のエントリが存在する(国別下限のリグレッションガード)', () => {
    const counts = new Map<string, number>();
    for (const c of ROUTE_CITIES) {
      counts.set(c.country, (counts.get(c.country) || 0) + 1);
    }
    const under = [...counts.entries()].filter(([, n]) => n < MIN_PER_COUNTRY);
    expect(under).toEqual([]);
    expect(counts.size).toBeGreaterThanOrEqual(30);
  });

  it('name は英語表記で空白以外の妥当な文字列である', () => {
    for (const c of ROUTE_CITIES) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.label.length).toBeGreaterThan(0);
    }
  });
});
