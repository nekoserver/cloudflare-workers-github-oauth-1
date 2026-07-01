import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');
const view = readFileSync(new URL('./views/webglHeritage.ts', import.meta.url).pathname, 'utf-8');

const postBlock = (() => {
  const idx = src.indexOf("app.post('/api/rail-station-cities'");
  return src.slice(idx, idx + 1500);
})();

const getBlock = (() => {
  const idx = src.indexOf("app.get('/api/rail-station-cities'");
  return src.slice(idx, idx + 600);
})();

const listBlock = (() => {
  const idx = src.indexOf("app.get('/api/rail-station-fetched-list'");
  return src.slice(idx, idx + 400);
})();

describe('POST /api/rail-station-cities — 差分追加（同期）', () => {
  it('既存データがある場合でも findNearbyCities を実行する（early-return を持たない）', () => {
    const earlyReturn = postBlock.indexOf('if (existing)');
    expect(earlyReturn).toBe(-1);
  });

  it('INSERT OR IGNORE で差分のみ追加する', () => {
    expect(postBlock).toContain('INSERT OR IGNORE INTO rail_station_cities');
  });

  it('force フラグで rail_station_fetched を削除できる', () => {
    expect(postBlock).toContain('DELETE FROM rail_station_fetched');
  });

  it('city_count を最新の DB 件数で更新する', () => {
    expect(postBlock).toContain('INSERT OR REPLACE INTO rail_station_fetched');
  });

  it('最終的に DB から最新の全都市を SELECT して返す', () => {
    expect(postBlock).toContain('SELECT city_name, city_lat, city_lon, population, distance_km, country_code FROM rail_station_cities WHERE station_name');
  });
});

describe('GET /api/rail-station-cities', () => {
  it('未取得の駅は fetched:false を返す', () => {
    expect(getBlock).toContain('fetched: false');
  });

  it('rail_station_fetched を参照して取得済み判定する', () => {
    expect(getBlock).toContain('FROM rail_station_fetched WHERE station_name');
  });
});

describe('GET /api/rail-station-fetched-list', () => {
  it('city_count > 0 の駅名一覧のみを返す', () => {
    expect(listBlock).toContain('WHERE city_count > 0');
  });
});

describe('D1テーブル定義・登録の整合性', () => {
  it('rail_station_cities / rail_station_fetched のマイグレーションSQLが定義されている', () => {
    expect(src).toContain('CREATE TABLE IF NOT EXISTS rail_station_cities');
    expect(src).toContain('CREATE TABLE IF NOT EXISTS rail_station_fetched');
  });

  it('STATUS_TABLE_DEFINITIONS に両テーブルが登録されている', () => {
    expect(src).toMatch(/name: 'rail_station_cities'/);
    expect(src).toMatch(/name: 'rail_station_fetched'/);
  });

  it('TABLE_COLUMN_KEYS に両テーブルのPK/FK/UK定義がある', () => {
    expect(src).toMatch(/rail_station_cities: \{ id: 'pk', station_name: 'idx', city_name: 'uk' \}/);
    expect(src).toMatch(/rail_station_fetched: \{ station_name: 'pk' \}/);
  });

  it('TABLE_GROUP_MAP に両テーブルが登録されている', () => {
    expect(src).toMatch(/rail_station_cities: 'system'/);
    expect(src).toMatch(/rail_station_fetched: 'system'/);
  });
});

describe('クライアント — 駅キャッシュアイコン', () => {
  const cacheFnBlock = (() => {
    const idx = view.indexOf('function cacheStationCities');
    return view.slice(idx, idx + 500);
  })();

  it('POST /api/rail-station-cities を呼び出す', () => {
    expect(cacheFnBlock).toContain("fetch('/api/rail-station-cities'");
    expect(cacheFnBlock).toContain("method: 'POST'");
  });

  it('取得済み駅名一覧を起動時にフェッチしてキャッシュ済みフラグに反映する', () => {
    const idx = view.indexOf("fetch('/api/rail-station-fetched-list')");
    expect(idx).not.toBe(-1);
    const block = view.slice(idx, idx + 300);
    expect(block).toContain('hasStationDataSet[n] = true');
  });
});
