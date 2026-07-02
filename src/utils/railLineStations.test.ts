import { describe, it, expect } from 'vitest';
import { buildRailLineStationRows, haversineKm, findNearbyStationsAndHeritage } from './railLineStations';
import { RAIL_LINES } from '../data/railLines';
import type { RailLine } from '../data/railLines';
import type { HeritagePoint } from './railLineStations';

describe('buildRailLineStationRows', () => {
  it('各路線の駅数の合計と同じ件数の行を生成する', () => {
    const rows = buildRailLineStationRows(RAIL_LINES);
    const expectedCount = RAIL_LINES.reduce((sum, line) => sum + line.stations.length, 0);
    expect(rows.length).toBe(expectedCount);
  });

  it('station_order は各路線内で1始まりの連番になる', () => {
    const line: RailLine = {
      name: 'テスト線', flag: '🏳️', country: 'テスト国', stations: [
        { name: 'A駅', lat: 1, lon: 2 },
        { name: 'B駅', lat: 3, lon: 4 },
        { name: 'C駅', lat: 5, lon: 6 },
      ],
    };
    const rows = buildRailLineStationRows([line]);
    expect(rows.map(r => r.stationOrder)).toEqual([1, 2, 3]);
  });

  it('駅に country/flag が指定されていればそれを優先する', () => {
    const line: RailLine = {
      name: '国際線', flag: '🇦', country: 'A国', stations: [
        { name: 'X駅', lat: 1, lon: 2, country: 'B国', flag: '🇧' },
      ],
    };
    const rows = buildRailLineStationRows([line]);
    expect(rows[0].stationCountry).toBe('B国');
    expect(rows[0].stationFlag).toBe('🇧');
  });

  it('駅に country/flag が指定されていなければ路線側を継承する', () => {
    const line: RailLine = {
      name: '国内線', flag: '🇯🇵', country: '日本', stations: [
        { name: 'Y駅', lat: 1, lon: 2 },
      ],
    };
    const rows = buildRailLineStationRows([line]);
    expect(rows[0].stationCountry).toBe('日本');
    expect(rows[0].stationFlag).toBe('🇯🇵');
  });

  it('空の路線配列に対しては空配列を返す', () => {
    expect(buildRailLineStationRows([])).toEqual([]);
  });

  it('lat/lon をそのまま引き継ぐ', () => {
    const line: RailLine = {
      name: 'Z線', flag: '🏳️', country: 'Z国', stations: [
        { name: 'Z駅', lat: 12.345, lon: -67.891 },
      ],
    };
    const rows = buildRailLineStationRows([line]);
    expect(rows[0].lat).toBe(12.345);
    expect(rows[0].lon).toBe(-67.891);
  });

  it('駅が1つだけの路線では始発=終着となり距離は全て0になる', () => {
    const line: RailLine = {
      name: '単駅線', flag: '🏳️', country: 'テスト国', stations: [
        { name: 'A駅', lat: 35, lon: 139 },
      ],
    };
    const rows = buildRailLineStationRows([line]);
    expect(rows[0].distanceFromOriginKm).toBe(0);
    expect(rows[0].distanceToPrevKm).toBe(0);
    expect(rows[0].distanceToNextKm).toBe(0);
    expect(rows[0].distanceToTerminalKm).toBe(0);
  });

  it('始発駅からの距離・隣駅までの距離・終着駅までの距離を正しく計算する', () => {
    const line: RailLine = {
      name: '直線3駅', flag: '🏳️', country: 'テスト国', stations: [
        { name: 'A駅', lat: 0, lon: 0 },
        { name: 'B駅', lat: 0, lon: 1 },
        { name: 'C駅', lat: 0, lon: 3 },
      ],
    };
    const rows = buildRailLineStationRows([line]);
    const segAB = haversineKm(0, 0, 0, 1);
    const segBC = haversineKm(0, 1, 0, 3);

    // 始発駅 A
    expect(rows[0].distanceFromOriginKm).toBe(0);
    expect(rows[0].distanceToPrevKm).toBe(0);
    expect(rows[0].distanceToNextKm).toBeCloseTo(segAB, 6);
    expect(rows[0].distanceToTerminalKm).toBeCloseTo(segAB + segBC, 6);

    // 中間駅 B
    expect(rows[1].distanceFromOriginKm).toBeCloseTo(segAB, 6);
    expect(rows[1].distanceToPrevKm).toBeCloseTo(segAB, 6);
    expect(rows[1].distanceToNextKm).toBeCloseTo(segBC, 6);
    expect(rows[1].distanceToTerminalKm).toBeCloseTo(segBC, 6);

    // 終着駅 C
    expect(rows[2].distanceFromOriginKm).toBeCloseTo(segAB + segBC, 6);
    expect(rows[2].distanceToPrevKm).toBeCloseTo(segBC, 6);
    expect(rows[2].distanceToNextKm).toBe(0);
    expect(rows[2].distanceToTerminalKm).toBe(0);
  });

  it('複数路線を渡しても距離計算は路線ごとに独立している（他路線の駅を混ぜない）', () => {
    const lineA: RailLine = {
      name: '路線A', flag: '🏳️', country: 'テスト国', stations: [
        { name: 'A1駅', lat: 0, lon: 0 },
        { name: 'A2駅', lat: 0, lon: 1 },
      ],
    };
    const lineB: RailLine = {
      name: '路線B', flag: '🏳️', country: 'テスト国', stations: [
        { name: 'B1駅', lat: 10, lon: 10 },
        { name: 'B2駅', lat: 10, lon: 11 },
      ],
    };
    const rows = buildRailLineStationRows([lineA, lineB]);
    const b1 = rows.find(r => r.stationName === 'B1駅')!;
    expect(b1.distanceFromOriginKm).toBe(0);
    expect(b1.distanceToPrevKm).toBe(0);
  });

  it('haversineKm は同一座標では0を返す', () => {
    expect(haversineKm(35.681, 139.767, 35.681, 139.767)).toBe(0);
  });

  it('haversineKm は既知の2点間距離をおおむね正しく計算する（東京駅～新大阪駅は約400km前後）', () => {
    const km = haversineKm(35.681, 139.767, 34.734, 135.5);
    expect(km).toBeGreaterThan(390);
    expect(km).toBeLessThan(410);
  });
});

describe('findNearbyStationsAndHeritage', () => {
  const lineA: RailLine = {
    name: '路線A', flag: '🏳️', country: 'テスト国', stations: [
      { name: '起点駅', lat: 0, lon: 0 },
      { name: '近傍駅', lat: 0, lon: 0.5 },
      { name: '遠方駅', lat: 0, lon: 50 },
    ],
  };
  const heritageNear: HeritagePoint = { n: '近傍遺産', f: '🏛️', lat: 0.3, lon: 0 };
  const heritageFar: HeritagePoint = { n: '遠方遺産', f: '🏛️', lat: 50, lon: 50 };

  it('半径内の駅と世界遺産のみを距離昇順で返す', () => {
    const results = findNearbyStationsAndHeritage([lineA], [heritageNear, heritageFar], 0, 0, 100, '起点駅');
    expect(results.map(r => r.pointName)).toEqual(['近傍遺産', '近傍駅']);
    expect(results[0].distanceKm).toBeLessThan(results[1].distanceKm);
  });

  it('excludeStationName に一致する駅は自分自身として除外する', () => {
    const results = findNearbyStationsAndHeritage([lineA], [], 0, 0, 100, '起点駅');
    expect(results.some(r => r.pointName === '起点駅')).toBe(false);
  });

  it('半径外の駅・世界遺産は含めない', () => {
    const results = findNearbyStationsAndHeritage([lineA], [heritageNear, heritageFar], 0, 0, 100, '起点駅');
    expect(results.some(r => r.pointName === '遠方駅')).toBe(false);
    expect(results.some(r => r.pointName === '遠方遺産')).toBe(false);
  });

  it('pointType が station/heritage で正しく区別される', () => {
    const results = findNearbyStationsAndHeritage([lineA], [heritageNear], 0, 0, 100, '起点駅');
    const station = results.find(r => r.pointName === '近傍駅');
    const heritage = results.find(r => r.pointName === '近傍遺産');
    expect(station?.pointType).toBe('station');
    expect(heritage?.pointType).toBe('heritage');
  });

  it('該当する駅・世界遺産が無ければ空配列を返す', () => {
    const results = findNearbyStationsAndHeritage([lineA], [], 0, 0, 1, '起点駅');
    expect(results).toEqual([]);
  });
});
