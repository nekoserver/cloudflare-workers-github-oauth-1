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
  distanceFromOriginKm: number;
  distanceToPrevKm: number;
  distanceToNextKm: number;
  distanceToTerminalKm: number;
}

const EARTH_RADIUS_KM = 6371;

/**
 * 2点間の大圏距離（km）をHaversine公式で計算する。
 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * RAIL_LINES（路線ごとの駅配列）を rail_line_stations テーブル用の行データへ変換する。
 * 駅ごとの country/flag が未指定の場合は路線の country/flag を継承する。
 * station_order は各路線内で始発駅を1とした通し番号。
 * 距離系カラムは同一路線内の座標から算出する:
 *  - distanceFromOriginKm: 始発駅からの累積距離（始発駅自身は0）
 *  - distanceToPrevKm: 上り（一つ前）の隣駅までの距離（始発駅は0）
 *  - distanceToNextKm: 下り（一つ次）の隣駅までの距離（終着駅は0）
 *  - distanceToTerminalKm: 終着駅までの残り距離（終着駅自身は0）
 */
export function buildRailLineStationRows(lines: RailLine[]): RailLineStationRow[] {
  const rows: RailLineStationRow[] = [];
  for (const line of lines) {
    const stations = line.stations;
    const segmentKm: number[] = [];
    for (let i = 1; i < stations.length; i++) {
      segmentKm.push(haversineKm(stations[i - 1].lat, stations[i - 1].lon, stations[i].lat, stations[i].lon));
    }

    let cumulativeFromOrigin = 0;
    const distanceFromOrigin: number[] = stations.map((_, index) => {
      if (index === 0) return 0;
      cumulativeFromOrigin += segmentKm[index - 1];
      return cumulativeFromOrigin;
    });

    const totalKm = distanceFromOrigin[distanceFromOrigin.length - 1] ?? 0;

    stations.forEach((station, index) => {
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
        distanceFromOriginKm: distanceFromOrigin[index],
        distanceToPrevKm: index === 0 ? 0 : segmentKm[index - 1],
        distanceToNextKm: index === stations.length - 1 ? 0 : segmentKm[index],
        distanceToTerminalKm: totalKm - distanceFromOrigin[index],
      });
    });
  }
  return rows;
}
