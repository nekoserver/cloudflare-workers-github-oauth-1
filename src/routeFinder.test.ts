import { describe, expect, it } from 'vitest';
import { buildCorridorPool, cheapestInsertionRoutes, RoutePoint } from './utils/routeFinder';

function pt(name: string, lat: number, lon: number, kind: RoutePoint['kind'] = 'city'): RoutePoint {
  return { name, lat, lon, kind, icon: '📍' };
}

// 起点: パリ, 終点: ローマ(概算)。故障シナリオ:
//  (1) 起点/終点と同座標(または至近)の候補を経由地として拾ってしまい0km区間ができる
//  (2) 迂回距離の閾値を超えた遠方の候補(例: 東京)を紛れ込ませてしまう
//  (3) 同名候補の重複挿入で経路が壊れる
//  (4) 予算(倍率)を上げても経路が変化しない(スナップショットが増えない)のに重複した行を返してしまう
//  (5) 区間距離の合計が総合距離と一致しない(丸め誤差の蓄積含む)
const PARIS = pt('Paris', 48.8566, 2.3522);
const ROME = pt('Rome', 41.9028, 12.4964);

describe('buildCorridorPool', () => {
  it('起点・終点に至近(5km未満)の候補を除外する', () => {
    const pool = [pt('ParisNear', 48.86, 2.35), pt('RomeNear', 41.90, 12.50)];
    const corridor = buildCorridorPool(PARIS, ROME, pool, 500);
    expect(corridor).toEqual([]);
  });

  it('迂回距離がmaxDetourKmを超える遠方の候補(東京)を除外する', () => {
    const tokyo = pt('Tokyo', 35.6762, 139.6503);
    const corridor = buildCorridorPool(PARIS, ROME, [tokyo], 500);
    expect(corridor).toEqual([]);
  });

  it('パリ-ローマの経路上にあるミラノ・チューリッヒ程度の迂回は許容範囲(300km)に含まれる', () => {
    const milan = pt('Milan', 45.4642, 9.1900);
    const zurich = pt('Zurich', 47.3769, 8.5417);
    const corridor = buildCorridorPool(PARIS, ROME, [milan, zurich], 300);
    expect(corridor.map((c) => c.name).sort()).toEqual(['Milan', 'Zurich']);
  });

  it('同一kind+nameの重複候補は1件にまとめる', () => {
    const a = pt('Lyon', 45.7640, 4.8357);
    const b = pt('Lyon', 45.7640, 4.8357);
    const corridor = buildCorridorPool(PARIS, ROME, [a, b], 300);
    expect(corridor.length).toBe(1);
  });
});

describe('cheapestInsertionRoutes', () => {
  it('候補が空なら直行ルート(起点→終点)のみを1件返す', () => {
    const routes = cheapestInsertionRoutes(PARIS, ROME, [], [1.0, 1.2, 1.5]);
    expect(routes.length).toBe(1);
    expect(routes[0].waypoints.map((w) => w.name)).toEqual(['Paris', 'Rome']);
    expect(routes[0].legs.length).toBe(1);
    expect(routes[0].totalKm).toBeCloseTo(routes[0].legs[0].km, 1);
  });

  it('予算(倍率)が上がるほど経由地数・総距離は単調増加し、経路変化のないスナップショットは重複除去される', () => {
    const milan = pt('Milan', 45.4642, 9.1900);
    const zurich = pt('Zurich', 47.3769, 8.5417);
    const lyon = pt('Lyon', 45.7640, 4.8357);
    const corridor = [milan, zurich, lyon];
    const routes = cheapestInsertionRoutes(PARIS, ROME, corridor, [1.0, 1.05, 1.1, 1.2, 1.4, 2.0]);
    for (let i = 1; i < routes.length; i++) {
      expect(routes[i].waypoints.length).toBeGreaterThanOrEqual(routes[i - 1].waypoints.length);
      expect(routes[i].totalKm).toBeGreaterThanOrEqual(routes[i - 1].totalKm);
    }
    // 予算を十分大きくすれば全ての回廊候補が最終的に挿入される
    const last = routes[routes.length - 1];
    expect(last.waypoints.length).toBe(2 + corridor.length);
  });

  it('各ルートの区間距離(legs)の合計はtotalKmと一致する(丸め誤差0.5km以内)', () => {
    const milan = pt('Milan', 45.4642, 9.1900);
    const zurich = pt('Zurich', 47.3769, 8.5417);
    const routes = cheapestInsertionRoutes(PARIS, ROME, [milan, zurich], [1.0, 1.15, 1.5]);
    routes.forEach((r) => {
      const legSum = r.legs.reduce((s, l) => s + l.km, 0);
      expect(Math.abs(legSum - r.totalKm)).toBeLessThan(0.5);
    });
  });

  it('挿入した経由地は起点・終点と重複せず、順序通りに区間(from/to)が連結している', () => {
    const milan = pt('Milan', 45.4642, 9.1900);
    const zurich = pt('Zurich', 47.3769, 8.5417);
    const routes = cheapestInsertionRoutes(PARIS, ROME, [milan, zurich], [1.5]);
    const r = routes[routes.length - 1];
    expect(r.waypoints[0].name).toBe('Paris');
    expect(r.waypoints[r.waypoints.length - 1].name).toBe('Rome');
    for (let i = 0; i < r.legs.length; i++) {
      expect(r.legs[i].from).toBe(r.waypoints[i].name);
      expect(r.legs[i].to).toBe(r.waypoints[i + 1].name);
    }
  });

  it('直行距離より極端に短い予算(倍率1.0)では候補があっても経由地を追加しない', () => {
    const farDetour = pt('FarDetour', 46.5, 3.0);
    const routes = cheapestInsertionRoutes(PARIS, ROME, [farDetour], [1.0]);
    expect(routes[0].waypoints.map((w) => w.name)).toEqual(['Paris', 'Rome']);
  });
});
