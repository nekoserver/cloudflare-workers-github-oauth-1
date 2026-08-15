import { describe, it, expect } from 'vitest';
import { getWebGLFaultsPage } from './views/webglFaults';
import { FAULTS as SHARED_FAULTS } from './data/faults';
import { VOLCANOES as SHARED_VOLCANOES } from './data/volcanoes';

// 対象: 活断層ページ(/webgl-faults)の北マルク州(ハルマヘラ島)周辺の活火山・活断層データ
// (src/data/faults.ts の FAULTS 配列・src/data/volcanoes.ts の VOLCANOES 配列、
// および src/views/webglFaults.ts に埋め込まれた同期用の複製配列)。
// 活火山イブ山(ハルマヘラ島北西部)を追加し、周辺の主要な活断層として
// スラウェシ〜西パプアの鳥頭半島まで延びるソロン断層帯(左横ずれ)と、
// サンギヘ弧・ハルマヘラ弧が向き合って沈み込むモルッカ海衝突帯(両面沈み込み)の
// 2件を追加した。
//
// 故障シナリオ:
//   (1) src/data/faults.ts・volcanoes.ts にのみ追加し、webglFaults.ts の埋め込み
//       配列への同期を忘れる(このページはdata/*.tsをimportしておらず、埋め込み
//       配列が実際の表示に使われるため、同期漏れがあると画面に反映されない)
//   (2) id が重複し、既存の断層・火山と衝突する
//   (3) ソロン断層帯を右横ずれ(transformだが実態と逆の説明)など事実と異なる
//       向きで記述してしまう
//   (4) t(断層タイプ)が既存の5種類(subduction/transform/divergent/rift/thrust)
//       以外の値になり、フィルターボタン・凡例で表示できなくなる
//   (5) 既存のインドネシアの断層・火山が改変・重複してしまう

const NEW_FAULT_IDS = ['sorong_fault', 'molucca_sea_collision'];
const KNOWN_TYPES = new Set(['subduction', 'transform', 'divergent', 'rift', 'thrust']);

describe('活断層ページ 北マルク(ハルマヘラ)周辺の活火山イブ山の追加', () => {
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

  it('イブ山が新規に追加され、北マルク・ハルマヘラ島の座標範囲に収まる', () => {
    const v = SHARED_VOLCANOES.find((x) => x.id === 'ibu');
    expect(v).toBeDefined();
    expect(v!.n).toBe('イブ山');
    expect(v!.c).toContain('北マルク');
    expect(v!.lat).toBeCloseTo(1.488, 2);
    expect(v!.lon).toBeCloseTo(127.63, 2);
  });

  it('埋め込み配列(webglFaults.ts)にもイブ山が存在する', () => {
    expect(html).toContain("id:'ibu'");
    const idx = html.indexOf("id:'ibu'");
    const block = html.slice(idx, idx + 150);
    expect(block).toContain('北マルク');
  });

  it('VOLCANOES 配列内で id が重複していない(全世界の火山データ全体で)', () => {
    const ids = SHARED_VOLCANOES.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('活断層ページ 北マルク周辺の活断層(ソロン断層帯・モルッカ海衝突帯)の追加', () => {
  const html = getWebGLFaultsPage('tester');

  it('ソロン断層帯・モルッカ海衝突帯が新規に追加されている', () => {
    NEW_FAULT_IDS.forEach((id) => {
      expect(html).toContain("id:'" + id + "'");
    });
  });

  it('追加した断層は country にインドネシアを含む', () => {
    NEW_FAULT_IDS.forEach((id) => {
      const idx = html.indexOf("id:'" + id + "'");
      const block = html.slice(idx, idx + 200);
      expect(block).toContain("country:'インドネシア'");
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

  it('ソロン断層帯は左横ずれ(transform)として記述されている', () => {
    const idx = html.indexOf("id:'sorong_fault'");
    const block = html.slice(idx, idx + 300);
    expect(block).toContain("t:'transform'");
    expect(block).toContain('左横ずれ');
  });

  it('モルッカ海衝突帯は両面沈み込み(subduction)として記述されている', () => {
    const idx = html.indexOf("id:'molucca_sea_collision'");
    const block = html.slice(idx, idx + 300);
    expect(block).toContain("t:'subduction'");
    expect(block).toContain('沈み込み');
  });

  it('追加した各断層は center と pts に有効な緯度経度を持ち、北マルク〜スラウェシ〜西パプア周辺の範囲(南緯3〜北緯4度・東経123〜135度)に収まる', () => {
    NEW_FAULT_IDS.forEach((id) => {
      const idx = html.indexOf("id:'" + id + "'");
      expect(idx).toBeGreaterThan(-1);
      const block = html.slice(idx, idx + 700);
      const centerMatch = block.match(/center:\[([-.\d]+),([-.\d]+)\]/);
      expect(centerMatch).not.toBeNull();
      const lat = parseFloat(centerMatch![1]);
      const lon = parseFloat(centerMatch![2]);
      expect(lat).toBeGreaterThan(-3);
      expect(lat).toBeLessThan(4);
      expect(lon).toBeGreaterThan(123);
      expect(lon).toBeLessThan(135);
      expect(block).toMatch(/pts:\[\[[-.\d]+,[-.\d]+\](,\[[-.\d]+,[-.\d]+\])+\]/);
    });
  });

  it('ソロン断層帯は1998年の北マルク地震(津波)への言及、モルッカ海衝突帯は両面沈み込みへの言及がある', () => {
    const sorongIdx = html.indexOf("id:'sorong_fault'");
    const molIdx = html.indexOf("id:'molucca_sea_collision'");
    const sorongBlock = html.slice(sorongIdx, sorongIdx + 500);
    const molBlock = html.slice(molIdx, molIdx + 500);
    expect(sorongBlock).toContain('1998年');
    expect(sorongBlock).toContain('津波');
    expect(molBlock).toContain('両面沈み込み');
  });

  it('既存のジャワ海溝・パル・コロ断層・フローレス背弧断層が改変・重複なく残っている', () => {
    const existingIds = ['java_trench', 'palu_koro', 'flores_thrust'];
    existingIds.forEach((id) => {
      const matches = SHARED_FAULTS.filter((f) => f.id === id);
      expect(matches, id + ' が重複または欠落').toHaveLength(1);
    });
  });
});

describe('活断層ページ用の埋め込みデータ(webglFaults.ts)も共有データと同期している(北マルク追加分)', () => {
  it('webglFaults.ts の FAULTS 配列と共有データ(faults.ts)の件数が一致する（同期漏れの検知）', () => {
    const html = getWebGLFaultsPage('tester');
    const start = html.indexOf('var FAULTS = [');
    const end = html.indexOf('\n  var VOLCANOES', start);
    const block = html.slice(start, end);
    const inlineCount = (block.match(/id:'/g) || []).length;
    expect(inlineCount).toBe(SHARED_FAULTS.length);
  });

  it('webglFaults.ts の VOLCANOES 配列と共有データ(volcanoes.ts)の件数が一致する（同期漏れの検知）', () => {
    const html = getWebGLFaultsPage('tester');
    const start = html.indexOf('var VOLCANOES = [');
    expect(start).toBeGreaterThan(-1);
    const end = html.indexOf('\n  ];', start);
    const block = html.slice(start, end);
    const inlineCount = (block.match(/id:'/g) || []).length;
    expect(inlineCount).toBe(SHARED_VOLCANOES.length);
  });

  it('新規追加した北マルクの断層・火山idが埋め込み配列にも存在する', () => {
    const html = getWebGLFaultsPage('tester');
    [...NEW_FAULT_IDS, 'ibu'].forEach((id) => {
      expect(html).toContain("id:'" + id + "'");
    });
  });
});
