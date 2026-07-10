import { describe, it, expect } from 'vitest';
import { buildRailLineStationRows, haversineKm, findNearbyStationsAndHeritage, dedupeNearbyPoints, diffAirportNearbyHeritage, findNearbyAirports, diffAirportNearbyAirport, filterWithinRadius, diffNearbyByDistance } from './railLineStations';
import { RAIL_LINES } from '../data/railLines';
import type { RailLine } from '../data/railLines';
import type { Airport } from '../data/airports';
import type { HeritagePoint, NearbyPoint, AirportNearbyHeritage, AirportNearbyAirport } from './railLineStations';

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

  it('同名の駅が複数路線に存在する場合は重複させず最も近い1件のみを返す（ツールチップの重複表示防止）', () => {
    const lineB: RailLine = {
      name: '路線B', flag: '🏳️', country: 'テスト国', stations: [
        { name: '近傍駅', lat: 0, lon: 0.5 },
      ],
    };
    const results = findNearbyStationsAndHeritage([lineA, lineB], [], 0, 0, 100, '起点駅');
    const matches = results.filter(r => r.pointName === '近傍駅');
    expect(matches.length).toBe(1);
  });

  it('同名の世界遺産が重複して見つかっても重複させず最も近い1件のみを返す', () => {
    const heritageDup: HeritagePoint = { n: '近傍遺産', f: '🏛️', lat: 0.31, lon: 0 };
    const results = findNearbyStationsAndHeritage([lineA], [heritageNear, heritageDup], 0, 0, 100, '起点駅');
    const matches = results.filter(r => r.pointName === '近傍遺産');
    expect(matches.length).toBe(1);
  });
});

describe('diffAirportNearbyHeritage', () => {
  const near: AirportNearbyHeritage = { heritageName: 'A遺産', lat: 0, lon: 0, distanceKm: 10 };
  const far: AirportNearbyHeritage = { heritageName: 'B遺産', lat: 1, lon: 1, distanceKm: 200 };

  it('DBに存在しない組は新規として差分に含める', () => {
    const result = diffAirportNearbyHeritage([near], new Map());
    expect(result).toEqual([near]);
  });

  it('DBに存在してもdistance_kmが変化していれば差分に含める（存在有無ではなく値の差分で判定する）', () => {
    const existing = new Map([['A遺産', 15]]);
    const result = diffAirportNearbyHeritage([near], existing);
    expect(result).toEqual([near]);
  });

  it('DBに存在しdistance_kmも一致していれば差分に含めない（同一値の再書き込みをしない）', () => {
    const existing = new Map([['A遺産', 10]]);
    const result = diffAirportNearbyHeritage([near], existing);
    expect(result).toEqual([]);
  });

  it('複数件のうち変化したものだけを差分として返す', () => {
    const existing = new Map([['A遺産', 10], ['B遺産', 999]]);
    const result = diffAirportNearbyHeritage([near, far], existing);
    expect(result).toEqual([far]);
  });

  it('候補が空配列なら差分も空配列', () => {
    expect(diffAirportNearbyHeritage([], new Map([['A遺産', 10]]))).toEqual([]);
  });
});

describe('filterWithinRadius（駅・空港などの「最寄りの候補を距離順に返す」共通処理の抽出）', () => {
  const items = [
    { id: 'near', lat: 0, lon: 1 },
    { id: 'far', lat: 0, lon: 50 },
  ];

  it('半径内の候補だけを距離昇順で返す', () => {
    const result = filterWithinRadius(items, 0, 0, 1000, i => ({ lat: i.lat, lon: i.lon }));
    expect(result.map(r => r.item.id)).toEqual(['near']);
    expect(result[0].distanceKm).toBeGreaterThan(0);
  });

  it('半径外の候補は含めない', () => {
    const result = filterWithinRadius(items, 0, 0, 1000, i => ({ lat: i.lat, lon: i.lon }));
    expect(result.some(r => r.item.id === 'far')).toBe(false);
  });

  it('距離が近い順にソートされる', () => {
    const mixed = [
      { id: 'B', lat: 0, lon: 10 },
      { id: 'A', lat: 0, lon: 1 },
    ];
    const result = filterWithinRadius(mixed, 0, 0, 2000, i => ({ lat: i.lat, lon: i.lon }));
    expect(result.map(r => r.item.id)).toEqual(['A', 'B']);
  });

  it('候補が空配列なら空配列を返す', () => {
    expect(filterWithinRadius([], 0, 0, 1000, () => ({ lat: 0, lon: 0 }))).toEqual([]);
  });
});

describe('diffNearbyByDistance（駅・空港などで共通の「値の差分だけ書き込む」判定処理の抽出）', () => {
  const items = [
    { key: 'A', distanceKm: 10 },
    { key: 'B', distanceKm: 200 },
  ];

  it('DBに存在しない組は新規として差分に含める', () => {
    const result = diffNearbyByDistance(items, new Map(), i => i.key, i => i.distanceKm);
    expect(result).toEqual(items);
  });

  it('DBに存在してもdistance_kmが変化していれば差分に含める（存在有無ではなく値の差分で判定する）', () => {
    const existing = new Map([['A', 15]]);
    const result = diffNearbyByDistance(items, existing, i => i.key, i => i.distanceKm);
    expect(result.map(r => r.key)).toEqual(['A', 'B']);
  });

  it('DBに存在しdistance_kmも一致していれば差分に含めない', () => {
    const existing = new Map([['A', 10], ['B', 200]]);
    const result = diffNearbyByDistance(items, existing, i => i.key, i => i.distanceKm);
    expect(result).toEqual([]);
  });
});

describe('findNearbyAirports', () => {
  const airports: Airport[] = [
    { code: 'AAA', name: '起点空港', city: 'テスト', lat: 0, lon: 0 },
    { code: 'BBB', name: '近傍空港', city: 'テスト', lat: 0, lon: 5 },
    { code: 'CCC', name: '遠方空港', city: 'テスト', lat: 0, lon: 50 },
  ];

  it('半径内の空港のみを距離昇順で返す', () => {
    const results = findNearbyAirports(airports, 0, 0, 1500, 'AAA');
    expect(results.map(r => r.otherAirportName)).toEqual(['近傍空港']);
  });

  it('excludeCode に一致する空港は自分自身として除外する', () => {
    const results = findNearbyAirports(airports, 0, 0, 100000, 'AAA');
    expect(results.some(r => r.otherAirportCode === 'AAA')).toBe(false);
  });

  it('半径外の空港は含めない', () => {
    const results = findNearbyAirports(airports, 0, 0, 1500, 'AAA');
    expect(results.some(r => r.otherAirportCode === 'CCC')).toBe(false);
  });

  it('該当する空港が無ければ空配列を返す', () => {
    expect(findNearbyAirports(airports, 0, 0, 1, 'AAA')).toEqual([]);
  });
});

describe('diffAirportNearbyAirport', () => {
  const near: AirportNearbyAirport = { otherAirportName: 'B空港', otherAirportCode: 'BBB', lat: 0, lon: 0, distanceKm: 10 };
  const far: AirportNearbyAirport = { otherAirportName: 'C空港', otherAirportCode: 'CCC', lat: 1, lon: 1, distanceKm: 1200 };

  it('DBに存在しない組は新規として差分に含める', () => {
    expect(diffAirportNearbyAirport([near], new Map())).toEqual([near]);
  });

  it('DBに存在してもdistance_kmが変化していれば差分に含める', () => {
    const existing = new Map([['B空港', 15]]);
    expect(diffAirportNearbyAirport([near], existing)).toEqual([near]);
  });

  it('DBに存在しdistance_kmも一致していれば差分に含めない', () => {
    const existing = new Map([['B空港', 10]]);
    expect(diffAirportNearbyAirport([near], existing)).toEqual([]);
  });

  it('複数件のうち変化したものだけを差分として返す', () => {
    const existing = new Map([['B空港', 10], ['C空港', 9999]]);
    expect(diffAirportNearbyAirport([near, far], existing)).toEqual([far]);
  });
});

describe('dedupeNearbyPoints', () => {
  it('pointType + pointName が同じ候補のうち最初の1件のみを残す', () => {
    const points: NearbyPoint[] = [
      { pointType: 'station', pointName: 'X駅', lat: 0, lon: 0, distanceKm: 5 },
      { pointType: 'station', pointName: 'X駅', lat: 0, lon: 0.01, distanceKm: 8 },
      { pointType: 'heritage', pointName: 'X駅', lat: 1, lon: 1, distanceKm: 10 },
    ];
    const result = dedupeNearbyPoints(points);
    expect(result.length).toBe(2);
    expect(result.filter(p => p.pointType === 'station').length).toBe(1);
    expect(result.find(p => p.pointType === 'station')?.distanceKm).toBe(5);
  });

  it('重複がなければすべてそのまま返す', () => {
    const points: NearbyPoint[] = [
      { pointType: 'station', pointName: 'A駅', lat: 0, lon: 0, distanceKm: 1 },
      { pointType: 'heritage', pointName: 'B遺産', lat: 1, lon: 1, distanceKm: 2 },
    ];
    expect(dedupeNearbyPoints(points)).toEqual(points);
  });

  it('空配列に対しては空配列を返す', () => {
    expect(dedupeNearbyPoints([])).toEqual([]);
  });
});
