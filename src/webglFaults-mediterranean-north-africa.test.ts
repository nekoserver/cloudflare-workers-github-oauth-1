import { describe, it, expect } from 'vitest';
import { getWebGLFaultsPage } from './views/webglFaults';
import { FAULTS as SHARED_FAULTS } from './data/faults';

const NEW_FAULT_IDS = [
  'calabrian_arc',
  'apennine',
  'betic_shear',
  'azores_gibraltar',
  'tell_atlas',
  'rif_fault',
  'hellenic_arc',
  'corinth_rift',
];

describe('活断層ページ 地中海・イタリア・スペイン・北アフリカの活断層追加', () => {
  const html = getWebGLFaultsPage('tester');

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

  it('イタリア・スペイン・北アフリカ・ギリシャの断層が新規に追加されている', () => {
    NEW_FAULT_IDS.forEach((id) => {
      expect(html).toContain("id:'" + id + "'");
    });
  });

  it('追加した断層は country にイタリア・スペイン・アルジェリア・モロッコ・ギリシャを含む', () => {
    expect(html).toContain("country:'イタリア'");
    expect(html).toContain("country:'スペイン'");
    expect(html).toContain("country:'アルジェリア'");
    expect(html).toContain("country:'モロッコ'");
    expect(html).toContain("country:'ギリシャ'");
  });

  it('FAULTS 配列内で id が重複していない', () => {
    const idMatches = Array.from(html.matchAll(/id:'([a-z_]+)', n:/g)).map((m) => m[1]);
    expect(idMatches.length).toBeGreaterThan(0);
    const unique = new Set(idMatches);
    expect(unique.size).toBe(idMatches.length);
  });

  it('追加した各断層は center と pts に有効な緯度経度を持つ', () => {
    NEW_FAULT_IDS.forEach((id) => {
      const idx = html.indexOf("id:'" + id + "'");
      expect(idx).toBeGreaterThan(-1);
      const block = html.slice(idx, idx + 700);
      const centerMatch = block.match(/center:\[([-.\d]+),([-.\d]+)\]/);
      expect(centerMatch).not.toBeNull();
      const lat = parseFloat(centerMatch![1]);
      const lon = parseFloat(centerMatch![2]);
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
      expect(block).toMatch(/pts:\[\[[-.\d]+,[-.\d]+\](,\[[-.\d]+,[-.\d]+\])+\]/);
    });
  });
});

describe('世界遺産ページ用の共有データ(src/data/faults.ts)も同期して追加されている', () => {
  it('地中海・北アフリカの新規断層が共有データにも存在する', () => {
    NEW_FAULT_IDS.forEach((id) => {
      expect(SHARED_FAULTS.some((f) => f.id === id)).toBe(true);
    });
  });

  it('共有データに id の重複がない', () => {
    const ids = SHARED_FAULTS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('webglFaults.ts の FAULTS 配列と共有データの件数が一致する（同期漏れの検知）', () => {
    const html = getWebGLFaultsPage('tester');
    const start = html.indexOf('var FAULTS = [');
    const end = html.indexOf('\n  var VOLCANOES', start);
    const block = html.slice(start, end);
    const inlineCount = (block.match(/id:'/g) || []).length;
    expect(inlineCount).toBe(SHARED_FAULTS.length);
  });
});
