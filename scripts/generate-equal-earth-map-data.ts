/**
 * イコールアース図法(Equal Earth projection)の白地図データを生成するスクリプト。
 * 実行結果は src/data/equalEarthMapData.ts に書き出し、実行時(Workerリクエスト時)は
 * このスクリプトを再実行せず、生成済みの静的データをそのままページに埋め込む。
 *
 * 投影式は Šavrič, Patterson, Jenny (2018) の Equal Earth projection の閉形式。
 * 大陸・湖の輪郭は Natural Earth の 1:110m Cultural/Physical Vectors
 * (Public Domain, https://www.naturalearthdata.com/about/terms-of-use/) の
 * land / lakes レイヤーを scripts/data/*.geojson として同梱し、これを実際の
 * 海岸線データとして使用する(手作業の簡略化ポリゴンではない)。
 *
 * 実行方法: npx tsx scripts/generate-equal-earth-map-data.ts
 */
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;

// lambda, phi はラジアン。返り値は投影後の生の座標(x, y)で、
// 北(phiが正)がyの正方向になる(数学的なy-up座標系)。
function equalEarthRaw(lambda: number, phi: number): [number, number] {
  const l = Math.asin(M * Math.sin(phi));
  const l2 = l * l;
  const l6 = l2 * l2 * l2;
  const x = (lambda * Math.cos(l)) / (M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2)));
  const y = l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2));
  return [x, y];
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function projectDeg(lon: number, lat: number): [number, number] {
  const [x, yUp] = equalEarthRaw(toRad(lon), toRad(lat));
  return [x, -yUp]; // SVGはyが下向きに増えるため反転する
}

type GeoRing = [number, number][];
type GeoJsonFeatureCollection = {
  type: 'FeatureCollection';
  features: { type: 'Feature'; geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown } }[];
};

// GeoJSONのPolygon/MultiPolygonから、全リング(外周+穴)をフラットな配列で取り出す。
function extractRings(fc: GeoJsonFeatureCollection): GeoRing[] {
  const rings: GeoRing[] = [];
  for (const feature of fc.features) {
    const geom = feature.geometry;
    if (geom.type === 'Polygon') {
      for (const ring of geom.coordinates as GeoRing[]) rings.push(ring);
    } else {
      for (const polygon of geom.coordinates as GeoRing[][]) {
        for (const ring of polygon) rings.push(ring);
      }
    }
  }
  return rings;
}

// 経線180度をまたぐリングは、投影後に地図を横断する偽の直線が生じてしまうため、
// 経度が180度を超えて急変する箇所でサブパスを分割する(単純な対蹠線カット)。
function ringToSubpaths(ring: GeoRing): GeoRing[] {
  const subpaths: GeoRing[] = [[]];
  for (let i = 0; i < ring.length; i++) {
    const point = ring[i];
    if (i > 0) {
      const prev = ring[i - 1];
      if (Math.abs(point[0] - prev[0]) > 180) {
        subpaths.push([]);
      }
    }
    subpaths[subpaths.length - 1].push(point);
  }
  return subpaths.filter((sp) => sp.length >= 2);
}

// 経線(縦線)・緯線(横線)のグラティキュール(格子線)を生成する。
function buildGraticuleLines(): { lon: number; lat: number }[][] {
  const lines: { lon: number; lat: number }[][] = [];
  for (let lon = -180; lon <= 180; lon += 30) {
    const line: { lon: number; lat: number }[] = [];
    for (let lat = -90; lat <= 90; lat += 3) line.push({ lon, lat });
    lines.push(line);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const line: { lon: number; lat: number }[] = [];
    for (let lon = -180; lon <= 180; lon += 3) line.push({ lon, lat });
    lines.push(line);
  }
  return lines;
}

// 全ジオメトリのバウンディングボックスを求め、目的の描画幅に収まるよう
// 縦横同一スケールで拡大・平行移動する(等積図法の性質を崩さないため)。
function computeBounds(allPoints: [number, number][]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of allPoints) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}

const CITIES_DEG: { name: string; lon: number; lat: number }[] = [
  { name: '東京', lon: 139.6917, lat: 35.6895 },
  { name: 'ニューヨーク', lon: -74.006, lat: 40.7128 },
  { name: 'ロンドン', lon: -0.1278, lat: 51.5074 },
  { name: 'パリ', lon: 2.3522, lat: 48.8566 },
  { name: '北京', lon: 116.4074, lat: 39.9042 },
  { name: 'デリー', lon: 77.1025, lat: 28.7041 },
  { name: 'モスクワ', lon: 37.6173, lat: 55.7558 },
  { name: 'カイロ', lon: 31.2357, lat: 30.0444 },
  { name: 'シドニー', lon: 151.2093, lat: -33.8688 },
  { name: 'リオデジャネイロ', lon: -43.1729, lat: -22.9068 },
  { name: 'ロサンゼルス', lon: -118.2437, lat: 34.0522 },
  { name: 'メキシコシティ', lon: -99.1332, lat: 19.4326 },
  { name: 'サンパウロ', lon: -46.6333, lat: -23.5505 },
  { name: 'ブエノスアイレス', lon: -58.3816, lat: -34.6037 },
  { name: 'ラゴス', lon: 3.3792, lat: 6.5244 },
  { name: 'ナイロビ', lon: 36.8219, lat: -1.2921 },
  { name: 'ヨハネスブルグ', lon: 28.0473, lat: -26.2041 },
  { name: 'イスタンブール', lon: 28.9784, lat: 41.0082 },
  { name: 'ドバイ', lon: 55.2708, lat: 25.2048 },
  { name: 'シンガポール', lon: 103.8198, lat: 1.3521 },
  { name: 'バンコク', lon: 100.5018, lat: 13.7563 },
  { name: 'ソウル', lon: 126.978, lat: 37.5665 },
  { name: 'ジャカルタ', lon: 106.8456, lat: -6.2088 },
  { name: 'オークランド', lon: 174.7633, lat: -36.8485 },
  { name: 'ホノルル', lon: -157.8583, lat: 21.3069 },
  { name: 'レイキャビク', lon: -21.9426, lat: 64.1466 },
  { name: 'トロント', lon: -79.3832, lat: 43.6532 },
];

const TARGET_WIDTH = 2600;
const PADDING = 40;

function main() {
  const dataDir = join(__dirname, 'data');
  const landFc: GeoJsonFeatureCollection = JSON.parse(readFileSync(join(dataDir, 'ne_110m_land.geojson'), 'utf-8'));
  const lakesFc: GeoJsonFeatureCollection = JSON.parse(readFileSync(join(dataDir, 'ne_110m_lakes.geojson'), 'utf-8'));

  const landRings = extractRings(landFc);
  const lakeRings = extractRings(lakesFc);

  const graticuleLines = buildGraticuleLines();

  // スケール計算用に、経緯線の格子点全て(=地図全体の外周に相当)を集める。
  const boundsSourcePoints: [number, number][] = [];
  for (const line of graticuleLines) {
    for (const p of line) boundsSourcePoints.push(projectDeg(p.lon, p.lat));
  }
  const bounds = computeBounds(boundsSourcePoints);
  const rawWidth = bounds.maxX - bounds.minX;
  const scale = (TARGET_WIDTH - PADDING * 2) / rawWidth;
  const rawHeight = bounds.maxY - bounds.minY;
  const mapHeight = Math.round(rawHeight * scale + PADDING * 2);
  const mapWidth = TARGET_WIDTH;

  function toSvg(x: number, y: number): [number, number] {
    return [(x - bounds.minX) * scale + PADDING, (y - bounds.minY) * scale + PADDING];
  }

  function ringsToPathD(rings: GeoRing[]): string {
    let d = '';
    for (const ring of rings) {
      for (const subpath of ringToSubpaths(ring)) {
        const pts = subpath.map(([lon, lat]) => toSvg(...projectDeg(lon, lat)));
        d += 'M' + pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L') + 'Z';
      }
    }
    return d;
  }

  function pathFromLineSvg(line: { lon: number; lat: number }[]): string {
    const pts = line.map((p) => toSvg(...projectDeg(p.lon, p.lat)));
    return 'M' + pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L');
  }

  const landPathD = ringsToPathD(landRings);
  const lakePathD = ringsToPathD(lakeRings);
  const graticulePaths = graticuleLines.map((line) => pathFromLineSvg(line));

  const cities = CITIES_DEG.map((c) => {
    const [x, y] = toSvg(...projectDeg(c.lon, c.lat));
    return { name: c.name, lat: c.lat, lon: c.lon, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
  });

  const output = `/**
 * イコールアース図法(Equal Earth projection)の白地図データ。
 * scripts/generate-equal-earth-map-data.ts の実行結果を書き出したもの(自動生成)。
 * 大陸・湖の輪郭は Natural Earth 1:110m land/lakes(Public Domain)を実際の
 * 海岸線データとして投影したものであり、手作業の簡略化ポリゴンではない。
 *
 * 再生成: npx tsx scripts/generate-equal-earth-map-data.ts
 */
export const EQUAL_EARTH_MAP_WIDTH = ${mapWidth};
export const EQUAL_EARTH_MAP_HEIGHT = ${mapHeight};

export const EQUAL_EARTH_LAND_PATH_D: string = ${JSON.stringify(landPathD)};
export const EQUAL_EARTH_LAKES_PATH_D: string = ${JSON.stringify(lakePathD)};

export const EQUAL_EARTH_GRATICULE_PATHS: string[] = ${JSON.stringify(graticulePaths, null, 2)};

export type EqualEarthCity = { name: string; lat: number; lon: number; x: number; y: number };
export const EQUAL_EARTH_CITIES: EqualEarthCity[] = ${JSON.stringify(cities, null, 2)};
`;

  const outPath = join(__dirname, '..', 'src', 'data', 'equalEarthMapData.ts');
  writeFileSync(outPath, output);
  console.log('written:', outPath, `(${mapWidth}x${mapHeight})`);
}

main();
