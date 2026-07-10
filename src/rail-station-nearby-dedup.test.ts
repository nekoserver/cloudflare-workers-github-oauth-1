import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');
const view = readFileSync(new URL('./views/webglHeritage.ts', import.meta.url).pathname, 'utf-8');

const getBlock = (() => {
  const idx = src.indexOf("app.get('/api/rail-station-nearby'");
  return src.slice(idx, idx + 1200);
})();

const postBlock = (() => {
  const idx = src.indexOf("app.post('/api/rail-station-nearby'");
  return src.slice(idx, idx + 2600);
})();

describe('GET /api/rail-station-nearby — 重複データを表示しない', () => {
  it('DBから取得した結果を dedupeNearbyPointRows で重複排除してから返す', () => {
    expect(getBlock).toContain('dedupeNearbyPointRows(result.results)');
  });
});

describe('POST /api/rail-station-nearby — 既存キャッシュが無いものだけを追加する', () => {
  it('INSERT前に既存の point_type+point_name 一覧を取得する', () => {
    expect(postBlock).toContain('SELECT point_type, point_name FROM rail_station_nearby_points WHERE station_name = ?');
    expect(postBlock).toContain('existingKeys');
  });

  it('既存キャッシュに無い候補だけを newPoints としてフィルタしてから INSERT する', () => {
    const filterIdx = postBlock.indexOf('const newPoints = points.filter');
    expect(filterIdx).toBeGreaterThan(-1);
    expect(postBlock).toContain('!existingKeys.has(p.pointType + \'|\' + p.pointName)');
    const insertIdx = postBlock.indexOf('INSERT OR IGNORE INTO rail_station_nearby_points');
    expect(insertIdx).toBeGreaterThan(filterIdx);
    expect(postBlock).toContain('db.batch(newPoints.map(');
  });

  it('返却前にも dedupeNearbyPointRows で重複排除する', () => {
    expect(postBlock).toContain('const dedupedPoints = dedupeNearbyPointRows(allPoints.results)');
    expect(postBlock).toContain('points: dedupedPoints');
  });

  it('point_count は重複排除後の件数で更新する', () => {
    expect(postBlock).toContain("bind(name, dedupedPoints.length)");
  });
});

describe('dedupeNearbyPointRows ヘルパー', () => {
  it('railLineStations の dedupeNearbyPoints を使って重複排除する', () => {
    const idx = src.indexOf('function dedupeNearbyPointRows');
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 400);
    expect(block).toContain('dedupeNearbyPoints(');
  });

  it('index.ts は railLineStations から dedupeNearbyPoints をインポートしている', () => {
    expect(src).toContain("import { findNearbyStationsAndHeritage, dedupeNearbyPoints, findNearbyHeritageForAirport } from './utils/railLineStations'");
  });
});

describe('クライアント — ツールチップの重複データ表示防止', () => {
  it('renderNearbyPointsList は表示前に dedupeNearbyPointsForDisplay で重複排除する', () => {
    const idx = view.indexOf('function renderNearbyPointsList');
    expect(idx).toBeGreaterThan(-1);
    const block = view.slice(idx, idx + 500);
    expect(block).toContain('dedupeNearbyPointsForDisplay(points)');
  });

  it('dedupeNearbyPointsForDisplay は point_type+point_name の組み合わせで重複を除去する', () => {
    const idx = view.indexOf('function dedupeNearbyPointsForDisplay');
    expect(idx).toBeGreaterThan(-1);
    const block = view.slice(idx, idx + 400);
    expect(block).toContain("p.point_type + '|' + p.point_name");
  });
});
