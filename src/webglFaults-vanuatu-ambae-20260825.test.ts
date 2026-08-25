import { describe, expect, it } from 'vitest';
import { FAULTS } from './data/faults';
import { VOLCANOES } from './data/volcanoes';
import { getWebGLFaultsPage } from './views/webglFaults';

const VANUATU_FAULT_IDS = ['new_hebrides_trench'];
const AMBAE_NEARBY_VOLCANO_IDS = ['gaua', 'ambrym', 'lopevi'];

describe('活断層ページ アンバエ火山周辺の活断層・活火山', () => {
  it('ニューヘブリデス海溝をバヌアツの沈み込み帯として収録する', () => {
    const fault = FAULTS.find((item) => item.id === 'new_hebrides_trench');
    expect(fault).toBeDefined();
    expect(fault!.n).toBe('ニューヘブリデス海溝（バヌアツ沈み込み帯）');
    expect(fault!.t).toBe('subduction');
    expect(fault!.country).toContain('バヌアツ');
    expect(fault!.desc).toContain('オーストラリアプレート');
    expect(fault!.desc).toContain('バヌアツ弧');
    expect(fault!.pts.length).toBeGreaterThanOrEqual(6);
    fault!.pts.forEach(([lat, lon]) => {
      expect(lat).toBeGreaterThan(-24);
      expect(lat).toBeLessThan(-9);
      expect(lon).toBeGreaterThan(164);
      expect(lon).toBeLessThan(168);
    });
  });

  it('アンバエ周辺のガウア・アンブリム・ロペビ火山を収録する', () => {
    AMBAE_NEARBY_VOLCANO_IDS.forEach((id) => {
      const volcano = VOLCANOES.find((item) => item.id === id);
      expect(volcano, id + ' が見つからない').toBeDefined();
      expect(volcano!.c).toContain('バヌアツ');
      expect(volcano!.lat).toBeGreaterThan(-17);
      expect(volcano!.lat).toBeLessThan(-14);
      expect(volcano!.lon).toBeGreaterThan(167);
      expect(volcano!.lon).toBeLessThan(169);
    });
  });

  it('共有データと活断層ページの埋め込みデータを同期する', () => {
    const html = getWebGLFaultsPage('tester');
    [...VANUATU_FAULT_IDS, ...AMBAE_NEARBY_VOLCANO_IDS].forEach((id) => {
      expect(html).toContain("id:'" + id + "'");
    });

    const faultsStart = html.indexOf('var FAULTS = [');
    const faultsEnd = html.indexOf('\n  var VOLCANOES', faultsStart);
    expect((html.slice(faultsStart, faultsEnd).match(/id:'/g) || []).length).toBe(FAULTS.length);

    const volcanoesStart = html.indexOf('var VOLCANOES = [');
    const volcanoesEnd = html.indexOf('\n  ];', volcanoesStart);
    expect((html.slice(volcanoesStart, volcanoesEnd).match(/id:'/g) || []).length).toBe(VOLCANOES.length);
  });

  it('断層・火山のIDに重複がない', () => {
    expect(new Set(FAULTS.map((item) => item.id)).size).toBe(FAULTS.length);
    expect(new Set(VOLCANOES.map((item) => item.id)).size).toBe(VOLCANOES.length);
  });
});
