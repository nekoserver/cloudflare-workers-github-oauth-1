import type { RailLine } from '../data/railLines';

export interface RailLineStationRow {
  lineName: string;
  lineFlag: string;
  lineCountry: string;
  stationName: string;
  stationOrder: number;
  lat: number;
  lon: number;
  stationCountry: string;
  stationFlag: string;
}

/**
 * RAIL_LINES（路線ごとの駅配列）を rail_line_stations テーブル用の行データへ変換する。
 * 駅ごとの country/flag が未指定の場合は路線の country/flag を継承する。
 * station_order は各路線内で始発駅を1とした通し番号。
 */
export function buildRailLineStationRows(lines: RailLine[]): RailLineStationRow[] {
  const rows: RailLineStationRow[] = [];
  for (const line of lines) {
    line.stations.forEach((station, index) => {
      rows.push({
        lineName: line.name,
        lineFlag: line.flag,
        lineCountry: line.country,
        stationName: station.name,
        stationOrder: index + 1,
        lat: station.lat,
        lon: station.lon,
        stationCountry: station.country ?? line.country,
        stationFlag: station.flag ?? line.flag,
      });
    });
  }
  return rows;
}
