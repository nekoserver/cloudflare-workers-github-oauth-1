import { HERITAGE_LIST } from '../data/heritageList';
import { F1_CIRCUITS } from '../data/f1Circuits';
import { ROUTE_CITIES } from '../data/routeCities';
import { buildCorridorPool, cheapestInsertionRoutes, RouteCandidate, RoutePoint } from '../utils/routeFinder';

const EUROPE_LAT_MIN = 36, EUROPE_LAT_MAX = 61, EUROPE_LON_MIN = -12, EUROPE_LON_MAX = 35;
const MAX_DETOUR_KM = 250;
const BUDGET_MULTIPLIERS = [1.0, 1.15, 1.35, 1.6];

interface RoutePair {
  startName: string;
  endName: string;
  label: string;
}

const ROUTE_PAIRS: RoutePair[] = [
  { startName: 'パリ', endName: 'ローマ', label: 'パリ → ローマ' },
  { startName: 'パリ', endName: 'ブダペスト', label: 'パリ → ブダペスト' },
  { startName: 'パリ', endName: 'プラハ', label: 'パリ → プラハ' },
];

function inEurope(lat: number, lon: number): boolean {
  return lat >= EUROPE_LAT_MIN && lat <= EUROPE_LAT_MAX && lon >= EUROPE_LON_MIN && lon <= EUROPE_LON_MAX;
}

/**
 * ROUTE_CITIES(都市)・HERITAGE_LIST(世界遺産、ヨーロッパ域内のみ)・F1_CIRCUITS(F1開催地、
 * ヨーロッパ域内のみ)を統合した経由地候補プールを組み立てる。
 */
export function buildCandidatePool(): RoutePoint[] {
  const cityPoints: RoutePoint[] = ROUTE_CITIES.map((c) => ({ name: c.label, lat: c.lat, lon: c.lon, kind: 'city', icon: '🏙️' }));
  const heritagePoints: RoutePoint[] = HERITAGE_LIST
    .filter((h) => inEurope(h.lat, h.lon))
    .map((h) => ({ name: h.n, lat: h.lat, lon: h.lon, kind: 'heritage', icon: h.e, detail: h.c }));
  const f1Points: RoutePoint[] = F1_CIRCUITS
    .filter((f) => inEurope(f.lat, f.lon))
    .map((f) => ({ name: f.circuit, lat: f.lat, lon: f.lon, kind: 'f1', icon: '🏎️', detail: f.gp }));
  return [...cityPoints, ...heritagePoints, ...f1Points];
}

function findCity(pool: RoutePoint[], label: string): RoutePoint {
  const found = pool.find((p) => p.kind === 'city' && p.name === label);
  if (!found) throw new Error('都市が見つかりません: ' + label);
  return found;
}

export interface RoutePairResult {
  label: string;
  routes: RouteCandidate[];
}

/**
 * ROUTE_PAIRSの各区間について、最安挿入法による複数のルート案(経由地数の異なる案)を
 * 総合距離の昇順で返す。
 */
export function computeAllRoutePairs(): RoutePairResult[] {
  const pool = buildCandidatePool();
  return ROUTE_PAIRS.map((pair) => {
    const start = findCity(pool, pair.startName);
    const end = findCity(pool, pair.endName);
    const corridor = buildCorridorPool(start, end, pool, MAX_DETOUR_KM);
    const routes = cheapestInsertionRoutes(start, end, corridor, BUDGET_MULTIPLIERS)
      .slice()
      .sort((a, b) => a.totalKm - b.totalKm);
    return { label: pair.label, routes };
  });
}

function esc(s: string): string {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
}

function waypointBadges(route: RouteCandidate): string {
  return route.waypoints.map((w) => '<span class="wp-badge wp-' + w.kind + '">' + esc(w.icon) + ' ' + esc(w.name) + '</span>').join('<span class="wp-arrow">→</span>');
}

function legsTable(route: RouteCandidate): string {
  const rows = route.legs.map((l, i) => (
    '<tr><td class="num">' + (i + 1) + '</td><td>' + esc(l.from) + '</td><td>' + esc(l.to) + '</td><td class="num">' + l.km.toFixed(1) + ' km</td></tr>'
  )).join('');
  return '<table class="legs-table"><thead><tr><th>区間</th><th>出発</th><th>到着</th><th>距離</th></tr></thead><tbody>' + rows
    + '<tr class="total-row"><td colspan="3">総合距離</td><td class="num">' + route.totalKm.toFixed(1) + ' km</td></tr></tbody></table>';
}

function routeCard(route: RouteCandidate, rank: number): string {
  const stops = route.waypoints.length - 2;
  return '<details class="route-card"' + (rank === 1 ? ' open' : '') + '>'
    + '<summary><span class="rank">#' + rank + '</span><span class="total">' + route.totalKm.toFixed(1) + ' km</span>'
    + '<span class="stops">経由地 ' + stops + ' 件</span></summary>'
    + '<div class="wp-line">' + waypointBadges(route) + '</div>'
    + legsTable(route)
    + '</details>';
}

function pairSection(result: RoutePairResult): string {
  const cards = result.routes.map((r, i) => routeCard(r, i + 1)).join('');
  return '<section class="pair-section"><h2>' + esc(result.label) + '</h2>'
    + '<div class="pair-meta">総合距離が短い順に ' + result.routes.length + ' 案</div>'
    + cards + '</section>';
}

export function getHeritageRoutesPage(): string {
  const results = computeAllRoutePairs();
  const body = results.map(pairSection).join('');
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Heritage Routes — 都市・世界遺産・F1開催地を巡る経路</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0}
.wrap{max-width:960px;margin:0 auto;padding:24px}
.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
h1{font-size:22px;margin:0}
.muted{color:#94a3b8;font-size:12px;margin-bottom:20px}
h2{font-size:17px;margin:0 0 4px;color:#93c5fd}
.pair-section{margin-bottom:28px}
.pair-meta{color:#94a3b8;font-size:12px;margin-bottom:10px}
.route-card{background:#111827;border:1px solid #334155;border-radius:12px;margin-bottom:10px;overflow:hidden}
.route-card summary{cursor:pointer;list-style:none;padding:12px 14px;display:flex;align-items:center;gap:12px;font-size:13px}
.route-card summary::-webkit-details-marker{display:none}
.rank{font-weight:700;color:#fde68a;min-width:32px}
.total{font-weight:700;color:#5eead4}
.stops{color:#94a3b8;margin-left:auto}
.wp-line{padding:0 14px 12px;font-size:12px;line-height:2.1}
.wp-badge{display:inline-block;background:#1e293b;border:1px solid #334155;border-radius:999px;padding:2px 9px;white-space:nowrap}
.wp-badge.wp-city{border-color:#3b82f6}
.wp-badge.wp-heritage{border-color:#eab308}
.wp-badge.wp-f1{border-color:#ef4444}
.wp-arrow{color:#64748b;margin:0 4px}
.legs-table{width:100%;border-collapse:collapse;font-size:12px}
.legs-table th,.legs-table td{padding:6px 10px;border-bottom:1px solid #1e293b;text-align:left}
.legs-table th{background:#1e293b;color:#bfdbfe;position:sticky;top:0}
.legs-table td.num,.legs-table th:last-child{text-align:right}
.legs-table .total-row td{font-weight:700;color:#5eead4;border-top:2px solid #334155;border-bottom:none}
</style>
</head>
<body>
<div class="wrap">
  <div class="top"><h1>Heritage Routes</h1></div>
  <div class="muted">都市・世界遺産・F1開催地を経由しながら総合距離をなるべく抑えた複数ルート案(最安挿入法による概算)。各区間の距離はHaversine公式による大圏距離です。</div>
  ${body}
</div>
</body>
</html>`;
}
