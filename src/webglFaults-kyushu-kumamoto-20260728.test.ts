import { describe, it, expect } from 'vitest';
import { getWebGLFaultsPage } from './views/webglFaults';
import { FAULTS as SHARED_FAULTS } from './data/faults';

// 対象: 活断層ページ(/webgl-faults)の熊本・九州の活断層データ
// (src/data/faults.ts の FAULTS 配列、および src/views/webglFaults.ts に埋め込まれた
// 同期用の複製配列)。2026年7月28日に発生した熊本県熊本地方の地震(M7.1、日奈久断層帯
// 南部の活動とみられる)を踏まえ、熊本地震(2016年)の震源断層である布田川断層帯・
// 日奈久断層帯に加え、大分県の別府-万年山断層帯、福岡市直下の警固断層帯を追加した。
//
// 故障シナリオ:
//   (1) src/data/faults.ts にのみ追加し、webglFaults.ts の埋め込み配列への同期を忘れる
//       (このページは data/faults.ts を import しておらず、埋め込み配列が実際の表示に
//       使われるため、同期漏れがあると画面に反映されない)
//   (2) 座標が熊本・大分・福岡の範囲外(緯度経度の入れ違い・符号ミス)
//   (3) id が重複し、既存断層と衝突する
//   (4) t(断層タイプ)が既存の5種類(subduction/transform/divergent/rift/thrust)以外の
//       値になり、フィルターボタン・凡例で表示できなくなる

const NEW_FAULT_IDS = ['futagawa', 'hinagu', 'beppu_haneyama', 'kego'];

const KNOWN_TYPES = new Set(['subduction', 'transform', 'divergent', 'rift', 'thrust']);

describe('活断層ページ 熊本・九州の活断層追加', () => {
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

  it('布田川・日奈久・別府-万年山・警固の断層が新規に追加されている', () => {
    NEW_FAULT_IDS.forEach((id) => {
      expect(html).toContain("id:'" + id + "'");
    });
  });

  it('追加した断層は country に日本を含む', () => {
    NEW_FAULT_IDS.forEach((id) => {
      const idx = html.indexOf("id:'" + id + "'");
      const block = html.slice(idx, idx + 200);
      expect(block).toContain("country:'日本'");
    });
  });

  it('FAULTS 配列内で id が重複していない', () => {
    const idMatches = Array.from(html.matchAll(/id:'([a-z_]+)', n:/g)).map((m) => m[1]);
    expect(idMatches.length).toBeGreaterThan(0);
    const unique = new Set(idMatches);
    expect(unique.size).toBe(idMatches.length);
  });

  it('追加した各断層のtは既存の5種別(subduction/transform/divergent/rift/thrust)のいずれかである', () => {
    NEW_FAULT_IDS.forEach((id) => {
      const idx = html.indexOf("id:'" + id + "'");
      const block = html.slice(idx, idx + 200);
      const tMatch = block.match(/t:'([a-z]+)'/);
      expect(tMatch, id + ' の t が見つからない').not.toBeNull();
      expect(KNOWN_TYPES.has(tMatch![1]), id + ' の t=' + tMatch![1] + ' が未知の型').toBe(true);
    });
  });

  it('追加した各断層は center と pts に有効な緯度経度を持ち、九州の範囲(北緯30〜34度・東経129〜132度)に収まる', () => {
    NEW_FAULT_IDS.forEach((id) => {
      const idx = html.indexOf("id:'" + id + "'");
      expect(idx).toBeGreaterThan(-1);
      const block = html.slice(idx, idx + 700);
      const centerMatch = block.match(/center:\[([-.\d]+),([-.\d]+)\]/);
      expect(centerMatch).not.toBeNull();
      const lat = parseFloat(centerMatch![1]);
      const lon = parseFloat(centerMatch![2]);
      expect(lat).toBeGreaterThan(30);
      expect(lat).toBeLessThan(34);
      expect(lon).toBeGreaterThan(129);
      expect(lon).toBeLessThan(132);
      expect(block).toMatch(/pts:\[\[[-.\d]+,[-.\d]+\](,\[[-.\d]+,[-.\d]+\])+\]/);
    });
  });

  it('布田川断層帯・日奈久断層帯の説明文に2016年熊本地震への言及がある', () => {
    const futagawaIdx = html.indexOf("id:'futagawa'");
    const hinaguIdx = html.indexOf("id:'hinagu'");
    const futagawaBlock = html.slice(futagawaIdx, futagawaIdx + 500);
    const hinaguBlock = html.slice(hinaguIdx, hinaguIdx + 500);
    expect(futagawaBlock).toContain('熊本地震');
    expect(hinaguBlock).toContain('熊本地震');
  });
});

describe('世界遺産ページ用の共有データ(src/data/faults.ts)も同期して追加されている', () => {
  it('熊本・九州の新規断層が共有データにも存在する', () => {
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
