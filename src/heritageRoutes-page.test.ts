import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { computeAllRoutePairs, getHeritageRoutesPage, buildCandidatePool } from './views/heritageRoutes';

// 対象: /heritage-routes ページ。パリ→ローマ・パリ→ブダペスト・パリ→プラハの3区間について、
// 都市・世界遺産(ヨーロッパ域内)・F1開催地(ヨーロッパ域内)を経由地候補として、
// 最安挿入法で複数のルート案(経由地数の異なる案)を総合距離の昇順で提示する。
// 故障シナリオ:
//   (1) 候補プールにヨーロッパ域外(例: 日本の世界遺産)が紛れ込み、無関係な経由地が出る
//   (2) ルート案が総合距離の昇順になっていない
//   (3) 同一のルート案(経由地数・順序とも同じ)が重複して表示される
//   (4) 区間(leg)のfrom/toが経由地の並び順と食い違う
//   (5) 総合距離が区間距離の合計と大きくずれる(丸め誤差の蓄積)
describe('buildCandidatePool', () => {
  it('ヨーロッパ域外の世界遺産(日本など)は候補プールに含まれない', () => {
    const pool = buildCandidatePool();
    const japan = pool.find((p) => p.kind === 'heritage' && p.name === '富士山');
    expect(japan).toBeUndefined();
  });

  it('ヨーロッパ域内の世界遺産・都市・F1開催地はそれぞれ1件以上候補に含まれる', () => {
    const pool = buildCandidatePool();
    expect(pool.some((p) => p.kind === 'heritage')).toBe(true);
    expect(pool.some((p) => p.kind === 'city')).toBe(true);
    expect(pool.some((p) => p.kind === 'f1')).toBe(true);
  });
});

describe('computeAllRoutePairs', () => {
  const results = computeAllRoutePairs();

  it('パリ→ローマ・パリ→ブダペスト・パリ→プラハの3区間を返す', () => {
    expect(results.map((r) => r.label)).toEqual(['パリ → ローマ', 'パリ → ブダペスト', 'パリ → プラハ']);
  });

  it('各区間のルート案は1件以上あり、総合距離の昇順に並んでいる', () => {
    results.forEach((r) => {
      expect(r.routes.length).toBeGreaterThan(0);
      for (let i = 1; i < r.routes.length; i++) {
        expect(r.routes[i].totalKm).toBeGreaterThanOrEqual(r.routes[i - 1].totalKm);
      }
    });
  });

  it('同一区間内でルート案(経由地の並び)が重複しない', () => {
    results.forEach((r) => {
      const signatures = r.routes.map((route) => route.waypoints.map((w) => w.kind + ':' + w.name).join('>'));
      expect(new Set(signatures).size).toBe(signatures.length);
    });
  });

  it('各ルート案は起点・終点の都市名で始まり終わる', () => {
    const rome = results.find((r) => r.label === 'パリ → ローマ')!;
    rome.routes.forEach((route) => {
      expect(route.waypoints[0].name).toBe('パリ');
      expect(route.waypoints[route.waypoints.length - 1].name).toBe('ローマ');
    });
  });

  it('各ルート案の区間(from/to)は経由地の並び順と一致する', () => {
    results.forEach((r) => {
      r.routes.forEach((route) => {
        for (let i = 0; i < route.legs.length; i++) {
          expect(route.legs[i].from).toBe(route.waypoints[i].name);
          expect(route.legs[i].to).toBe(route.waypoints[i + 1].name);
        }
      });
    });
  });

  it('区間距離の合計は総合距離と概ね一致する(丸め誤差1km以内)', () => {
    results.forEach((r) => {
      r.routes.forEach((route) => {
        const legSum = route.legs.reduce((s, l) => s + l.km, 0);
        expect(Math.abs(legSum - route.totalKm)).toBeLessThan(1);
      });
    });
  });
});

describe('getHeritageRoutesPage', () => {
  it('3区間すべての見出しとルートカード・区間テーブルを含む', () => {
    const html = getHeritageRoutesPage();
    expect(html).toContain('パリ → ローマ');
    expect(html).toContain('パリ → ブダペスト');
    expect(html).toContain('パリ → プラハ');
    expect(html).toContain('class="route-card"');
    expect(html).toContain('class="legs-table"');
    expect(html).toContain('総合距離');
  });
});

describe('/heritage-routes ルート登録', () => {
  it('src/index.ts にルートが登録されている', () => {
    const src = readFileSync('src/index.ts', 'utf8');
    expect(src).toContain("app.get('/heritage-routes'");
    expect(src).toContain('getHeritageRoutesPage');
  });
});
