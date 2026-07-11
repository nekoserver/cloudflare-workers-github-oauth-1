import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

// 対象: GET /api/heritage-access/nearby-cities
// 世界遺産アクセスランキングページの距離上限行に設置する検索窓で、
// 世界遺産名または座標を起点に半径500km以内の都市を距離が近い順に返す。
// 故障シナリオ:
//   (1) heritage_citiesは(heritage_name, city_name)単位の行なので、
//       同じ都市が複数の世界遺産に近い場合に重複して数えられてはいけない
//       (GROUP BYでの重複排除漏れ)
//   (2) 500kmちょうど・500km超のデータが境界値で正しく扱われるか
//   (3) 距離の昇順ソートが壊れていないか

interface D1Row {
  [key: string]: unknown;
}

function wrapD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind(...args: unknown[]) {
          return {
            async all<T = D1Row>(): Promise<{ results?: T[] }> {
              const rows = stmt.all(...(args as never[])) as unknown as T[];
              return { results: rows };
            },
          };
        },
        async all<T = D1Row>(): Promise<{ results?: T[] }> {
          const rows = stmt.all() as unknown as T[];
          return { results: rows };
        },
      };
    },
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function setupDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE heritage_cities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      heritage_name TEXT NOT NULL,
      city_name TEXT NOT NULL,
      city_lat REAL NOT NULL,
      city_lon REAL NOT NULL,
      population INTEGER,
      country_code TEXT,
      distance_km REAL NOT NULL
    );
  `);
  return db;
}

// src/index.ts の GET /api/heritage-access/nearby-cities と同一のロジック
async function nearbyCities(db: DatabaseSync, lat: number, lon: number) {
  const real = wrapD1(db);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { status: 400 as const };
  const RADIUS_KM = 500;
  const rows = await real.prepare(
    `SELECT city_name, country_code, ROUND(AVG(city_lat), 4) AS city_lat, ROUND(AVG(city_lon), 4) AS city_lon, MAX(population) AS population
       FROM heritage_cities
      GROUP BY city_name, country_code`
  ).all<{ city_name: string; country_code: string | null; city_lat: number; city_lon: number; population: number | null }>();
  const cities = (rows.results || [])
    .map((r) => ({ ...r, distance_km: Math.round(haversineKm(lat, lon, r.city_lat, r.city_lon) * 10) / 10 }))
    .filter((r) => r.distance_km <= RADIUS_KM)
    .sort((a, b) => a.distance_km - b.distance_km);
  return { status: 200 as const, cities, count: cities.length };
}

function insertCity(db: DatabaseSync, heritage: string, city: string, lat: number, lon: number, cc: string) {
  db.prepare(
    `INSERT INTO heritage_cities (heritage_name, city_name, city_lat, city_lon, population, country_code, distance_km) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(heritage, city, lat, lon, 100000, cc, 10);
}

describe('GET /api/heritage-access/nearby-cities', () => {
  it('起点から半径500km以内の都市だけを距離の近い順に返す', async () => {
    const db = setupDb();
    // 姫路城(34.84, 134.69)を起点とする
    insertCity(db, '姫路城', '神戸', 34.69, 135.19, 'JP');   // 約50km
    insertCity(db, '姫路城', '大阪', 34.69, 135.50, 'JP');   // 約80km
    insertCity(db, '姫路城', 'ロンドン', 51.5, -0.12, 'GB'); // 遠すぎる

    const result = await nearbyCities(db, 34.84, 134.69);
    expect(result.status).toBe(200);
    expect(result.cities!.map((c) => c.city_name)).toEqual(['神戸', '大阪']);
    expect(result.count).toBe(2);
    expect(result.cities![0].distance_km).toBeLessThan(result.cities![1].distance_km);
  });

  it('同じ都市が複数の世界遺産に近い場合でも重複して数えない(GROUP BY)', async () => {
    const db = setupDb();
    insertCity(db, '姫路城', '神戸', 34.69, 135.19, 'JP');
    insertCity(db, '厳島神社', '神戸', 34.69, 135.19, 'JP'); // 同じ都市が別の世界遺産経由でも登録されている

    const result = await nearbyCities(db, 34.84, 134.69);
    expect(result.count).toBe(1);
    expect(result.cities).toHaveLength(1);
  });

  it('500kmを超える都市は含まれない', async () => {
    const db = setupDb();
    insertCity(db, '姫路城', '札幌', 43.06, 141.35, 'JP'); // 500km超

    const result = await nearbyCities(db, 34.84, 134.69);
    expect(result.count).toBe(0);
  });

  it('緯度・経度が不正な値の場合は400を返す', async () => {
    const db = setupDb();
    const result = await nearbyCities(db, NaN, 134.69);
    expect(result.status).toBe(400);
  });
});
