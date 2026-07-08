import { describe, it, expect } from 'vitest';
import { getWebGLSolarPage } from './webglSolar';

describe('getWebGLSolarPage', () => {
  const html = getWebGLSolarPage('tester');

  it('script タグ内の JS に構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  function extractRadArrays() {
    const lonMatch = html.match(/var starLon = \[([^\]]*)\];/);
    const latMatch = html.match(/var starLat = \[([^\]]*)\];/);
    expect(lonMatch).not.toBeNull();
    expect(latMatch).not.toBeNull();
    return {
      lons: lonMatch![1].split(',').map((s) => parseFloat(s.trim())),
      lats: latMatch![1].split(',').map((s) => parseFloat(s.trim())),
    };
  }

  it('starLon と starLat の要素数が一致し、星座線のインデックスが配列範囲内にある', () => {
    const { lons, lats } = extractRadArrays();
    expect(lons.length).toBe(lats.length);
    const linesMatch = html.match(/var skyConstellationLines = \[([\s\S]*?)\n  \];/);
    expect(linesMatch).not.toBeNull();
    const indices = Array.from(linesMatch![1].matchAll(/indices: \[([^\]]*)\]/g))
      .flatMap((m) => m[1].split(',').map((s) => parseInt(s.trim(), 10)));
    expect(indices.length).toBeGreaterThan(0);
    for (const idx of indices) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(lons.length);
    }
  });

  it('うお座・おひつじ座・おうし座・プレセペの各星が黄道座標(J2000)で登録されている', () => {
    const { lons, lats } = extractRadArrays();
    // 期待値: J2000 の黄道経度λ・黄道緯度β (rad)。
    // starLon/starLat は自転モード(projectSky)・今日の空モード(projectEclipticSky)の
    // 両方で黄道座標として扱われるため、赤道座標(RA/Dec)で登録すると星座が歪む。
    const expected: Array<{ idx: number; name: string; lon: number; lat: number }> = [
      { idx: 13, name: 'プレセペ星団',       lon: 2.2227, lat: 0.0223 },
      { idx: 18, name: 'プレアデス星団',     lon: 1.0471, lat: 0.0707 },
      { idx: 20, name: 'シェラタン',         lon: 0.5929, lat: 0.1481 },
      { idx: 21, name: 'ハマル',             lon: 0.6573, lat: 0.1739 },
      { idx: 22, name: 'メサルティム',       lon: 0.5792, lat: 0.1250 },
      { idx: 23, name: 'アルレシャ',         lon: 0.5128, lat: -0.1581 },
      { idx: 24, name: 'フム・アル・サマカー', lon: 6.0840, lat: 0.1580 },
      { idx: 25, name: 'トルクラー',         lon: 0.4842, lat: -0.0283 },
      { idx: 26, name: 'エルナト',           lon: 1.4412, lat: 0.0940 },
      { idx: 27, name: 'ゼータ・タウリ',     lon: 1.4798, lat: -0.0383 },
    ];
    for (const e of expected) {
      expect(Math.abs(lons[e.idx] - e.lon), `${e.name} の黄道経度`).toBeLessThan(0.02);
      expect(Math.abs(lats[e.idx] - e.lat), `${e.name} の黄道緯度`).toBeLessThan(0.02);
    }
  });

  function extractProject3D() {
    const m = html.match(/function project3D\(dX, dY, dZ\) \{[\s\S]*?\n  \}/);
    expect(m).not.toBeNull();
    const factory = new Function(
      'viewAngle', 'viewElev', 'fovH', 'W', 'H', 'skyViewMode',
      m![0] + '\nreturn project3D;'
    );
    return (mode: string) =>
      factory(0, 0.5, Math.PI * 0.6, 1000, 800, mode) as (
        x: number, y: number, z: number
      ) => { x: number; y: number } | null;
  }

  // 直線透視(ピンホール)投影は天球上の大円(経線・赤道)をすべて画面上の直線に
  // 写すため、グリッドがドーム状に見えない。今日の空・地軸固定・自転の3モードは
  // 平射(ステレオ)投影で大円が円弧に曲がることを検証する。
  it('今日の空・地軸固定・自転モードでは大円がドーム状の曲線として投影される', () => {
    const make = extractProject3D();
    for (const mode of ['today', 'pole', 'spin']) {
      const project = make(mode);
      const center = project(Math.cos(0.5), 0, Math.sin(0.5));
      expect(center, mode + ': 視線中心').not.toBeNull();
      expect(center!.x).toBeCloseTo(500, 3);
      expect(center!.y).toBeCloseTo(400, 3);
      const p1 = project(Math.cos(-0.7), Math.sin(-0.7), 0);
      const p2 = project(1, 0, 0);
      const p3 = project(Math.cos(0.7), Math.sin(0.7), 0);
      expect(p1 && p2 && p3, mode + ': 赤道上の3点が投影可能').toBeTruthy();
      const cross = (p2!.x - p1!.x) * (p3!.y - p1!.y) - (p2!.y - p1!.y) * (p3!.x - p1!.x);
      expect(Math.abs(cross), mode + ': 大円がドーム状に曲がる').toBeGreaterThan(1000);
    }
  });

  it('地球目線・月面・ISSモードは従来どおりの直線透視投影を維持する', () => {
    const make = extractProject3D();
    for (const mode of ['earth', 'moon', 'iss']) {
      const project = make(mode);
      const p1 = project(Math.cos(-0.7), Math.sin(-0.7), 0);
      const p2 = project(1, 0, 0);
      const p3 = project(Math.cos(0.7), Math.sin(0.7), 0);
      expect(p1 && p2 && p3, mode + ': 赤道上の3点が投影可能').toBeTruthy();
      const cross = (p2!.x - p1!.x) * (p3!.y - p1!.y) - (p2!.y - p1!.y) * (p3!.x - p1!.x);
      expect(Math.abs(cross), mode + ': 大円は直線のまま').toBeLessThan(1e-3);
    }
  });

  it('レグルスの黄道緯度(starLat)が実際の値(約+0.46度)に近い', () => {
    const lonMatch = html.match(/var starLon = \[([^\]]*)\];/);
    const latMatch = html.match(/var starLat = \[([^\]]*)\];/);
    expect(lonMatch).not.toBeNull();
    expect(latMatch).not.toBeNull();

    const lons = lonMatch![1].split(',').map((s) => parseFloat(s.trim()));
    const lats = latMatch![1].split(',').map((s) => parseFloat(s.trim()));

    // namedStars 配列でのレグルスのインデックスは 19 (0始まり)
    const regulusIdx = 19;
    const regulusLatDeg = (lats[regulusIdx] * 180) / Math.PI;
    const regulusLonDeg = (lons[regulusIdx] * 180) / Math.PI;

    // 実際のレグルスの黄道座標: 経度 約149.8度, 緯度 約+0.46度
    expect(regulusLatDeg).toBeGreaterThan(0);
    expect(regulusLatDeg).toBeLessThan(2);
    expect(regulusLonDeg).toBeGreaterThan(145);
    expect(regulusLonDeg).toBeLessThan(155);
  });
});
