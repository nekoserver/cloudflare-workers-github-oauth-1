/**
 * イコールアース図法(Equal Earth projection)の白地図データを生成するスクリプト。
 * 実行結果は src/data/equalEarthMapData.ts に書き出し、実行時(Workerリクエスト時)は
 * このスクリプトを再実行せず、生成済みの静的データをそのままページに埋め込む。
 *
 * 投影式は Šavrič, Patterson, Jenny (2018) の Equal Earth projection の閉形式。
 * 大陸の輪郭は実測の海岸線データではなく、主要な緯度経度の頂点を用いた簡略化
 * (低ポリゴン)形状であり、あくまで「白地図」として大陸の位置・概形が分かる
 * ことを目的とした近似である。
 *
 * 実行方法: npx tsx scripts/generate-equal-earth-map-data.ts
 */
import { writeFileSync } from 'fs';
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

// [経度, 緯度] (度)のリング(閉多角形)。実測の海岸線ではなく簡略化した近似形状。
const CONTINENT_RINGS_DEG: { name: string; ring: [number, number][] }[] = [
  {
    name: 'North America',
    ring: [
      [-165, 68], [-155, 71], [-130, 70], [-100, 73], [-80, 68], [-65, 60],
      [-55, 50], [-65, 45], [-75, 35], [-80, 25], [-97, 26], [-105, 20],
      [-115, 30], [-124, 40], [-124, 49], [-130, 55], [-140, 60], [-165, 68],
    ],
  },
  {
    name: 'South America',
    ring: [
      [-80, 10], [-77, 8], [-60, 10], [-50, 0], [-35, -8], [-40, -20],
      [-48, -25], [-58, -34], [-68, -54], [-72, -45], [-75, -20], [-80, -5], [-80, 10],
    ],
  },
  {
    name: 'Africa',
    ring: [
      [-17, 15], [-10, 5], [8, 5], [9, 0], [12, -5], [13, -15], [18, -34],
      [30, -30], [35, -20], [40, -15], [43, 0], [50, 10], [43, 12], [35, 15],
      [32, 28], [25, 32], [10, 37], [0, 35], [-6, 35], [-10, 30], [-17, 15],
    ],
  },
  {
    name: 'Eurasia',
    ring: [
      [-9, 43], [-5, 36], [0, 45], [5, 50], [10, 54], [20, 55], [30, 60],
      [40, 66], [60, 70], [90, 75], [130, 75], [160, 70], [180, 65], [170, 60],
      [160, 55], [140, 45], [130, 35], [122, 30], [110, 20], [100, 10], [95, 5],
      [80, 8], [68, 24], [60, 25], [50, 30], [35, 37], [28, 40], [23, 35],
      [15, 40], [10, 44], [-9, 43],
    ],
  },
  {
    name: 'Australia',
    ring: [
      [113, -22], [114, -30], [118, -34], [130, -32], [137, -35], [145, -38],
      [150, -37], [153, -28], [150, -15], [142, -11], [135, -12], [130, -15],
      [122, -18], [113, -22],
    ],
  },
  {
    name: 'Greenland',
    ring: [[-45, 60], [-25, 70], [-25, 80], [-45, 83], [-65, 80], [-70, 70], [-55, 60], [-45, 60]],
  },
  {
    name: 'Madagascar',
    ring: [[43, -25], [44, -16], [49, -13], [50, -22], [47, -25], [43, -25]],
  },
  {
    name: 'UK & Ireland',
    ring: [[-9, 54], [-6, 52], [-2, 51], [1, 52], [0, 55], [-3, 58], [-6, 58], [-9, 54]],
  },
  {
    name: 'New Zealand',
    ring: [[172, -41], [175, -37], [178, -38], [177, -44], [168, -46], [166, -42], [172, -41]],
  },
];

// 南極大陸は実際の海岸線を辿ると±180度をまたぐため、簡略化して
// 全経度幅をカバる帯として表現する(投影範囲の計算後にx方向いっぱいに広げる)。
const ANTARCTICA_LAT_TOP = -63;
const ANTARCTICA_LAT_BOTTOM = -89;

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

function projectDeg(lon: number, lat: number): [number, number] {
  const [x, yUp] = equalEarthRaw(toRad(lon), toRad(lat));
  return [x, -yUp]; // SVGはyが下向きに増えるため反転する
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

function pathFromLonLatRing(ring: [number, number][]): string {
  const pts = ring.map(([lon, lat]) => projectDeg(lon, lat));
  return 'M' + pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L') + 'Z';
}

function pathFromLonLatLine(line: { lon: number; lat: number }[]): string {
  const pts = line.map((p) => projectDeg(p.lon, p.lat));
  return 'M' + pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L');
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

const TARGET_WIDTH = 2600;
const PADDING = 40;

function main() {
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

  function pathFromRingSvg(ring: [number, number][]): string {
    const pts = ring.map(([lon, lat]) => toSvg(...projectDeg(lon, lat)));
    return 'M' + pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L') + 'Z';
  }

  function pathFromLineSvg(line: { lon: number; lat: number }[]): string {
    const pts = line.map((p) => toSvg(...projectDeg(p.lon, p.lat)));
    return 'M' + pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L');
  }

  const continentPaths = CONTINENT_RINGS_DEG.map((c) => ({ name: c.name, d: pathFromRingSvg(c.ring) }));

  // 南極大陸: 実際の海岸線ではなく、地図全幅をカバーする帯として簡略表現する。
  const antarcticaTopY = toSvg(0, projectDeg(0, ANTARCTICA_LAT_TOP)[1])[1];
  const antarcticaBottomY = toSvg(0, projectDeg(0, ANTARCTICA_LAT_BOTTOM)[1])[1];
  const antarcticaPath =
    `M${PADDING.toFixed(2)},${antarcticaTopY.toFixed(2)}` +
    `L${(mapWidth - PADDING).toFixed(2)},${antarcticaTopY.toFixed(2)}` +
    `L${(mapWidth - PADDING).toFixed(2)},${antarcticaBottomY.toFixed(2)}` +
    `L${PADDING.toFixed(2)},${antarcticaBottomY.toFixed(2)}Z`;
  continentPaths.push({ name: 'Antarctica', d: antarcticaPath });

  const graticulePaths = graticuleLines.map((line) => pathFromLineSvg(line));

  const cities = CITIES_DEG.map((c) => {
    const [x, y] = toSvg(...projectDeg(c.lon, c.lat));
    return { name: c.name, lat: c.lat, lon: c.lon, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
  });

  const output = `/**
 * イコールアース図法(Equal Earth projection)の白地図データ。
 * scripts/generate-equal-earth-map-data.ts の実行結果を書き出したもの(自動生成)。
 * 大陸の輪郭は実測の海岸線データではなく、主要な緯度経度の頂点を用いた簡略化
 * (低ポリゴン)形状であり、大陸の位置・概形が分かることを目的とした近似である。
 *
 * 再生成: npx tsx scripts/generate-equal-earth-map-data.ts
 */
export const EQUAL_EARTH_MAP_WIDTH = ${mapWidth};
export const EQUAL_EARTH_MAP_HEIGHT = ${mapHeight};

export type EqualEarthContinentPath = { name: string; d: string };
export const EQUAL_EARTH_CONTINENT_PATHS: EqualEarthContinentPath[] = ${JSON.stringify(continentPaths, null, 2)};

export const EQUAL_EARTH_GRATICULE_PATHS: string[] = ${JSON.stringify(graticulePaths, null, 2)};

export type EqualEarthCity = { name: string; lat: number; lon: number; x: number; y: number };
export const EQUAL_EARTH_CITIES: EqualEarthCity[] = ${JSON.stringify(cities, null, 2)};
`;

  const outPath = join(__dirname, '..', 'src', 'data', 'equalEarthMapData.ts');
  writeFileSync(outPath, output);
  console.log('written:', outPath, `(${mapWidth}x${mapHeight})`);
}

main();
