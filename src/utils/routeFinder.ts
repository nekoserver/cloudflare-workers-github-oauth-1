import { haversineKm } from './railLineStations';

export interface RoutePoint {
  name: string;
  lat: number;
  lon: number;
  kind: 'city' | 'heritage' | 'f1';
  icon: string;
  detail?: string;
}

export interface RouteLeg {
  from: string;
  to: string;
  km: number;
}

export interface RouteCandidate {
  waypoints: RoutePoint[];
  legs: RouteLeg[];
  totalKm: number;
}

const DEDUPE_RADIUS_KM = 5;

/**
 * 起点・終点からの детour(迂回)距離が maxDetourKm 以内の候補だけを残す。
 * 迂回距離 = 起点→候補→終点の距離 - 起点→終点の直線距離(常に0以上、三角不等式)。
 * 起点・終点自身、および起点・終点とほぼ同座標(DEDUPE_RADIUS_KM以内)の候補は除外する。
 */
export function buildCorridorPool(
  start: RoutePoint,
  end: RoutePoint,
  pool: RoutePoint[],
  maxDetourKm: number,
): RoutePoint[] {
  const directKm = haversineKm(start.lat, start.lon, end.lat, end.lon);
  const seen = new Set<string>();
  const result: RoutePoint[] = [];
  for (const p of pool) {
    const key = p.kind + ':' + p.name;
    if (seen.has(key)) continue;
    if (haversineKm(p.lat, p.lon, start.lat, start.lon) < DEDUPE_RADIUS_KM) continue;
    if (haversineKm(p.lat, p.lon, end.lat, end.lon) < DEDUPE_RADIUS_KM) continue;
    const detour = haversineKm(start.lat, start.lon, p.lat, p.lon)
      + haversineKm(p.lat, p.lon, end.lat, end.lon) - directKm;
    if (detour <= maxDetourKm) {
      seen.add(key);
      result.push(p);
    }
  }
  return result;
}

function routeTotalKm(route: RoutePoint[]): number {
  let sum = 0;
  for (let i = 1; i < route.length; i++) {
    sum += haversineKm(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon);
  }
  return sum;
}

function toLegs(route: RoutePoint[]): RouteLeg[] {
  const legs: RouteLeg[] = [];
  for (let i = 1; i < route.length; i++) {
    legs.push({
      from: route[i - 1].name,
      to: route[i].name,
      km: Math.round(haversineKm(route[i - 1].lat, route[i - 1].lon, route[i].lat, route[i].lon) * 10) / 10,
    });
  }
  return legs;
}

/**
 * 最安挿入法(cheapest insertion)でstart→endの経路にcorridorの候補地点を
 * 1件ずつ挿入していく。挿入位置は「その候補をルートのどこに挟んでも増える距離が
 * 最小になる位置」を毎回全候補×全位置から選び直す(貪欲法)。
 * budgetMultipliers(直線距離に対する倍率、昇順)ごとに、その時点までの挿入結果を
 * スナップショットとして記録し、複数の経由地数・総距離のルート案を返す。
 * 同一のスナップショット(直前と経由地順序が変わらない)は重複除去する。
 */
export function cheapestInsertionRoutes(
  start: RoutePoint,
  end: RoutePoint,
  corridor: RoutePoint[],
  budgetMultipliers: number[],
): RouteCandidate[] {
  const directKm = haversineKm(start.lat, start.lon, end.lat, end.lon);
  let route: RoutePoint[] = [start, end];
  const remaining = corridor.slice();
  const sortedBudgets = budgetMultipliers.slice().sort((a, b) => a - b);
  const snapshots: RouteCandidate[] = [];
  let lastSignature = '';

  const takeSnapshot = () => {
    const signature = route.map((p) => p.kind + ':' + p.name).join('>');
    if (signature === lastSignature) return;
    lastSignature = signature;
    snapshots.push({ waypoints: route.slice(), legs: toLegs(route), totalKm: Math.round(routeTotalKm(route) * 10) / 10 });
  };

  for (const budget of sortedBudgets) {
    const limitKm = directKm * budget;
    while (remaining.length > 0) {
      let bestIdx = -1, bestPos = -1, bestCost = Infinity;
      for (let ci = 0; ci < remaining.length; ci++) {
        const cand = remaining[ci];
        for (let pos = 1; pos < route.length; pos++) {
          const prev = route[pos - 1], next = route[pos];
          const cost = haversineKm(prev.lat, prev.lon, cand.lat, cand.lon)
            + haversineKm(cand.lat, cand.lon, next.lat, next.lon)
            - haversineKm(prev.lat, prev.lon, next.lat, next.lon);
          if (cost < bestCost) { bestCost = cost; bestIdx = ci; bestPos = pos; }
        }
      }
      if (bestIdx < 0) break;
      const projectedTotal = routeTotalKm(route) + bestCost;
      if (projectedTotal > limitKm) break;
      const [chosen] = remaining.splice(bestIdx, 1);
      route.splice(bestPos, 0, chosen);
    }
    takeSnapshot();
  }
  return snapshots;
}
