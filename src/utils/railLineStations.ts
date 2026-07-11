import type { RailLine } from '../data/railLines';
import type { Airport } from '../data/airports';

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

export interface HeritagePoint {
  n: string;
  f: string;
  lat: number;
  lon: number;
}

export interface NearbyPoint {
  pointType: 'station' | 'heritage';
  pointName: string;
  lat: number;
  lon: number;
  distanceKm: number;
}

/**
 * pointType + pointName が同じ候補を重複として除去する。
 * 距離昇順でソート済みの配列に適用すれば、同名の候補は最も近い1件のみが残る。
 */
export function dedupeNearbyPoints(points: NearbyPoint[]): NearbyPoint[] {
  const seen = new Set<string>();
  const deduped: NearbyPoint[] = [];
  for (const p of points) {
    const key = p.pointType + '|' + p.pointName;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(p);
  }
  return deduped;
}

/**
 * ある地点（駅）を中心に、半径radiusKm以内にある他の駅・世界遺産をまとめて距離昇順で返す。
 * excludeStationName と同名の駅（自分自身）は候補から除外する。
 * 同名の駅・世界遺産が複数路線などから重複して見つかった場合は、最も近い1件のみを残す
 * （dedupeNearbyPoints による重複排除）。
 */
export function findNearbyStationsAndHeritage(
  lines: RailLine[],
  heritages: HeritagePoint[],
  lat: number,
  lon: number,
  radiusKm: number,
  excludeStationName: string
): NearbyPoint[] {
  const results: NearbyPoint[] = [];

  for (const line of lines) {
    for (const station of line.stations) {
      if (station.name === excludeStationName) continue;
      const distanceKm = haversineKm(lat, lon, station.lat, station.lon);
      if (distanceKm <= radiusKm) {
        results.push({ pointType: 'station', pointName: station.name, lat: station.lat, lon: station.lon, distanceKm });
      }
    }
  }

  for (const heritage of heritages) {
    const distanceKm = haversineKm(lat, lon, heritage.lat, heritage.lon);
    if (distanceKm <= radiusKm) {
      results.push({ pointType: 'heritage', pointName: heritage.n, lat: heritage.lat, lon: heritage.lon, distanceKm });
    }
  }

  results.sort((a, b) => a.distanceKm - b.distanceKm);
  return dedupeNearbyPoints(results);
}

/**
 * 「ある地点を中心に半径radiusKm以内にある候補を距離昇順で返す」という、駅・空港・世界遺産
 * などジャンルを問わず共通する検索処理を抽出したもの。toLatLon で各候補の座標を取り出す
 * meta情報だけを渡せば、候補配列の型を問わず利用できる。
 */
export function filterWithinRadius<T>(
  items: T[],
  lat: number,
  lon: number,
  radiusKm: number,
  toLatLon: (item: T) => { lat: number; lon: number }
): Array<{ item: T; distanceKm: number }> {
  const results: Array<{ item: T; distanceKm: number }> = [];
  for (const item of items) {
    const pos = toLatLon(item);
    const distanceKm = haversineKm(lat, lon, pos.lat, pos.lon);
    if (distanceKm <= radiusKm) {
      results.push({ item, distanceKm });
    }
  }
  results.sort((a, b) => a.distanceKm - b.distanceKm);
  return results;
}

/**
 * 「候補のうちDBに書き込むべき差分（新規の組、またはdistance_kmが既存値と異なる組）だけを
 * 抽出する」という、駅・空港などジャンルを問わず共通する書き込み判定処理を抽出したもの。
 * 組がDBに存在するかどうかではなく、値そのものの差分の有無で書き込み対象を判定する。
 * keyOf/distanceOf でキー・距離の取り出し方を meta情報として渡すことで、候補配列の型を
 * 問わず利用できる。
 */
export function diffNearbyByDistance<T>(
  nearby: T[],
  existing: Map<string, number>,
  keyOf: (item: T) => string,
  distanceOf: (item: T) => number
): T[] {
  return nearby.filter(item => {
    const prevDistanceKm = existing.get(keyOf(item));
    return prevDistanceKm === undefined || prevDistanceKm !== distanceOf(item);
  });
}

export interface AirportNearbyHeritage {
  heritageName: string;
  lat: number;
  lon: number;
  distanceKm: number;
}

/**
 * 空港の座標を中心に、半径radiusKm以内にある世界遺産を距離昇順で返す。
 * 同名の世界遺産が複数見つかった場合は、最も近い1件のみを残す。
 */
export function findNearbyHeritageForAirport(
  heritages: HeritagePoint[],
  lat: number,
  lon: number,
  radiusKm: number
): AirportNearbyHeritage[] {
  const filtered = filterWithinRadius(heritages, lat, lon, radiusKm, h => ({ lat: h.lat, lon: h.lon }));

  const seen = new Set<string>();
  const deduped: AirportNearbyHeritage[] = [];
  for (const { item, distanceKm } of filtered) {
    if (seen.has(item.n)) continue;
    seen.add(item.n);
    deduped.push({ heritageName: item.n, lat: item.lat, lon: item.lon, distanceKm });
  }
  return deduped;
}

/**
 * 空港の近隣世界遺産候補のうち、DBに書き込むべき差分だけを抽出する。
 * diffNearbyByDistance に「heritageNameをキーにする」meta情報を渡した薄いラッパー。
 */
export function diffAirportNearbyHeritage(
  nearby: AirportNearbyHeritage[],
  existing: Map<string, number>
): AirportNearbyHeritage[] {
  return diffNearbyByDistance(nearby, existing, h => h.heritageName, h => h.distanceKm);
}

export interface AirportNearbyAirport {
  otherAirportName: string;
  otherAirportCode: string;
  lat: number;
  lon: number;
  distanceKm: number;
}

/**
 * 空港の座標を中心に、半径radiusKm以内にある他の空港を距離昇順で返す。
 * excludeCode と同じ空港コード（自分自身）は候補から除外する。
 */
export function findNearbyAirports(
  airports: Airport[],
  lat: number,
  lon: number,
  radiusKm: number,
  excludeCode: string
): AirportNearbyAirport[] {
  const candidates = airports.filter(apt => apt.code !== excludeCode);
  const filtered = filterWithinRadius(candidates, lat, lon, radiusKm, apt => ({ lat: apt.lat, lon: apt.lon }));
  return filtered.map(({ item, distanceKm }) => ({
    otherAirportName: item.name,
    otherAirportCode: item.code,
    lat: item.lat,
    lon: item.lon,
    distanceKm,
  }));
}

/**
 * 空港の近隣空港候補のうち、DBに書き込むべき差分だけを抽出する。
 * diffNearbyByDistance に「otherAirportNameをキーにする」meta情報を渡した薄いラッパー。
 * 空港＋世界遺産の場合（diffAirportNearbyHeritage）と同じ判定ルールを適用する。
 */
export function diffAirportNearbyAirport(
  nearby: AirportNearbyAirport[],
  existing: Map<string, number>
): AirportNearbyAirport[] {
  return diffNearbyByDistance(nearby, existing, a => a.otherAirportName, a => a.distanceKm);
}
