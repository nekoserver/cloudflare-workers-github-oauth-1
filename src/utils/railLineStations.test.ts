import { describe, it, expect } from 'vitest';
import { buildRailLineStationRows } from './railLineStations';
import { RAIL_LINES } from '../data/railLines';
import type { RailLine } from '../data/railLines';

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
});
