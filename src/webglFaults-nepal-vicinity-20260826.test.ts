import { describe, expect, it } from 'vitest';
import { FAULTS } from './data/faults';
import { VOLCANOES } from './data/volcanoes';
import { getWebGLFaultsPage } from './views/webglFaults';

const NEPAL_FAULT_IDS = ['himalayan_frontal_nepal', 'main_boundary_nepal', 'main_central_nepal'];
const NEARBY_VOLCANO_IDS = ['kunlun_volcanic_group', 'tengchong'];

describe('活断層ページ ネパール近郊データ', () => {
  const html = getWebGLFaultsPage('tester');

  it('ネパールを横断する3本の主要衝上断層を共有・表示データに収録する', () => {
    for (const id of NEPAL_FAULT_IDS) {
      const fault = FAULTS.find((item) => item.id === id);
      expect(fault).toBeDefined();
      expect(fault?.t).toBe('thrust');
      expect(fault?.country).toContain('ネパール');
      expect(fault?.pts.length).toBeGreaterThanOrEqual(8);
      expect(html).toContain(`id:'${id}'`);
    }
  });

  it('断層座標はネパール周辺にあり、IDは重複しない', () => {
    expect(new Set(FAULTS.map((item) => item.id)).size).toBe(FAULTS.length);
    for (const fault of FAULTS.filter((item) => NEPAL_FAULT_IDS.includes(item.id))) {
      for (const [lat, lon] of [fault.center, ...fault.pts]) {
        expect(lat).toBeGreaterThanOrEqual(26.5);
        expect(lat).toBeLessThanOrEqual(30);
        expect(lon).toBeGreaterThanOrEqual(80);
        expect(lon).toBeLessThanOrEqual(89);
      }
    }
  });

  it('国内に完新世火山がないことを踏まえ、周辺広域の2火山を明示して収録する', () => {
    expect(VOLCANOES.some((item) => item.c === 'ネパール')).toBe(false);
    for (const id of NEARBY_VOLCANO_IDS) {
      const volcano = VOLCANOES.find((item) => item.id === id);
      expect(volcano).toBeDefined();
      expect(volcano?.c).toContain('ネパール');
      expect(html).toContain(`id:'${id}'`);
    }
    expect(new Set(VOLCANOES.map((item) => item.id)).size).toBe(VOLCANOES.length);
  });

  it('埋め込みscriptは追加後も構文エラーなく評価できる', () => {
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) expect(() => new Function(script[1])).not.toThrow();
  });
});
