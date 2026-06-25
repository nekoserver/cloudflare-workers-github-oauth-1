import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');
const view = readFileSync(new URL('./views/webglHeritage.ts', import.meta.url).pathname, 'utf-8');

const postBlock = (() => {
  const idx = src.indexOf("app.post('/api/heritage-cities'");
  return src.slice(idx, idx + 1500);
})();

const getBlock = (() => {
  const idx = src.indexOf("app.get('/api/heritage-cities'");
  return src.slice(idx, idx + 600);
})();

describe('POST /api/heritage-cities — 差分追加（同期）', () => {
  it('既存データがある場合でも findNearbyCities を実行する（early-return を持たない）', () => {
    const earlyReturn = postBlock.indexOf("if (existing)");
    expect(earlyReturn).toBe(-1);
  });

  it('INSERT OR IGNORE で差分のみ追加する', () => {
    expect(postBlock).toContain('INSERT OR IGNORE INTO heritage_cities');
  });

  it('force フラグで heritage_city_fetched を削除できる', () => {
    expect(postBlock).toContain('DELETE FROM heritage_city_fetched');
  });

  it('city_count を最新の DB 件数で更新する', () => {
    expect(postBlock).toContain('INSERT OR REPLACE INTO heritage_city_fetched');
  });

  it('最終的に DB から最新の全都市を SELECT して返す', () => {
    expect(postBlock).toContain('SELECT city_name, city_lat, city_lon, population, distance_km, country_code FROM heritage_cities WHERE heritage_name');
  });
});

describe('クライアント — loadLandingCities 差分対応', () => {
  const loadBlock = (() => {
    const idx = view.indexOf('function loadLandingCities');
    return view.slice(idx, idx + 1200);
  })();

  it('GET の fetched:true だけで終了せず、常に POST で同期する', () => {
    const hasEarlyReturn = loadBlock.includes("if(data.fetched)") && loadBlock.includes("landingCities = data.cities");
    const alwaysPosts = loadBlock.includes("method: 'POST'");
    expect(alwaysPosts).toBe(true);
    if (hasEarlyReturn) {
      const postIdx = loadBlock.indexOf("method: 'POST'");
      const earlyIdx = loadBlock.indexOf("if(data.fetched)");
      expect(postIdx).toBeLessThan(earlyIdx === -1 ? Infinity : earlyIdx + 1);
    }
  });

  it('POST を最初に呼ぶ（GET-first パターンを廃止）', () => {
    const fetchIdx = loadBlock.indexOf("fetch('/api/heritage-cities'");
    const postIdx = loadBlock.indexOf("method: 'POST'");
    expect(fetchIdx).not.toBe(-1);
    expect(postIdx).not.toBe(-1);
    expect(postIdx - fetchIdx).toBeLessThan(200);
  });
});
