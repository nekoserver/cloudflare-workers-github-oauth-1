import { describe, it, expect } from 'vitest';
import { getWebGLFaultsPage } from './views/webglFaults';
import { FAULTS as SHARED_FAULTS } from './data/faults';
import { VOLCANOES as SHARED_VOLCANOES } from './data/volcanoes';

// 対象: 活断層ページ(/webgl-faults)のインドネシア周辺の活断層・活火山データ
// (src/data/faults.ts の FAULTS 配列・src/data/volcanoes.ts の VOLCANOES 配列、
// および src/views/webglFaults.ts に埋め込まれた同期用の複製配列)。
// 既存のスンダ海溝（スマトラ海溝）・スマトラ断層に加え、ジャワ島以東の
// スンダ海溝の続き(ジャワ海溝)、スラウェシ島のパル・コロ断層(2018年パル地震)、
// 小スンダ列島のフローレス背弧断層(2018年ロンボク島地震)を追加した。
// 活火山は既存5件(メラピ・クラカタウ・シナブン・スメル・アグン)に加え、
// タンボラ・リンジャニ・クルード・ソプタン・イジェンの5件を追加した。
//
// 故障シナリオ:
//   (1) src/data/faults.ts・volcanoes.ts にのみ追加し、webglFaults.ts の埋め込み
//       配列への同期を忘れる(このページはdata/*.tsをimportしておらず、埋め込み
//       配列が実際の表示に使われるため、同期漏れがあると画面に反映されない)
//   (2) id が重複し、既存の断層・火山と衝突する
//   (3) 座標がインドネシア周辺の範囲外(緯度経度の入れ違い・符号ミス)
//   (4) t(断層タイプ)が既存の5種類(subduction/transform/divergent/rift/thrust)
//       以外の値になり、フィルターボタン・凡例で表示できなくなる
//   (5) 既存のインドネシアの断層・火山が改変・重複してしまう

const NEW_FAULT_IDS = ['java_trench', 'palu_koro', 'flores_thrust'];
const NEW_VOLCANO_IDS = ['tambora', 'rinjani', 'kelud', 'soputan', 'ijen'];
const KNOWN_TYPES = new Set(['subduction', 'transform', 'divergent', 'rift', 'thrust']);

describe('活断層ページ インドネシア周辺の活断層追加', () => {
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

  it('ジャワ海溝・パル・コロ断層・フローレス背弧断層が新規に追加されている', () => {
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

  it('追加した各断層は center と pts に有効な緯度経度を持ち、インドネシア周辺の範囲(南緯12〜北緯2度・東経105〜132度)に収まる', () => {
    NEW_FAULT_IDS.forEach((id) => {
      const idx = html.indexOf("id:'" + id + "'");
      expect(idx).toBeGreaterThan(-1);
      const block = html.slice(idx, idx + 700);
      const centerMatch = block.match(/center:\[([-.\d]+),([-.\d]+)\]/);
      expect(centerMatch).not.toBeNull();
      const lat = parseFloat(centerMatch![1]);
      const lon = parseFloat(centerMatch![2]);
      expect(lat).toBeGreaterThan(-12);
      expect(lat).toBeLessThan(2);
      expect(lon).toBeGreaterThan(105);
      expect(lon).toBeLessThan(132);
      expect(block).toMatch(/pts:\[\[[-.\d]+,[-.\d]+\](,\[[-.\d]+,[-.\d]+\])+\]/);
    });
  });

  it('パル・コロ断層は2018年パル地震(スラウェシ島)への言及、フローレス背弧断層は2018年ロンボク島地震への言及がある', () => {
    const paluIdx = html.indexOf("id:'palu_koro'");
    const floresIdx = html.indexOf("id:'flores_thrust'");
    const paluBlock = html.slice(paluIdx, paluIdx + 500);
    const floresBlock = html.slice(floresIdx, floresIdx + 500);
    expect(paluBlock).toContain('2018年');
    expect(paluBlock).toContain('パル');
    expect(floresBlock).toContain('2018年');
    expect(floresBlock).toContain('ロンボク島');
  });

  it('既存のスンダ海溝(スマトラ海溝)・スマトラ断層が改変・重複なく残っている', () => {
    const existingIds = ['sumatra', 'sumatra_fault'];
    existingIds.forEach((id) => {
      const matches = SHARED_FAULTS.filter((f) => f.id === id);
      expect(matches, id + ' が重複または欠落').toHaveLength(1);
    });
  });
});

describe('活断層ページ インドネシア周辺の活火山追加', () => {
  const html = getWebGLFaultsPage('tester');

  it('タンボラ・リンジャニ・クルード・ソプタン・イジェンが新規に追加されている', () => {
    NEW_VOLCANO_IDS.forEach((id) => {
      expect(html).toContain("id:'" + id + "'");
    });
  });

  it('追加した火山は c にインドネシアを含む', () => {
    NEW_VOLCANO_IDS.forEach((id) => {
      const idx = html.indexOf("id:'" + id + "'");
      const block = html.slice(idx, idx + 150);
      expect(block).toContain('インドネシア');
    });
  });

  it('VOLCANOES 配列内で id が重複していない(全世界の火山データ全体で)', () => {
    const ids = SHARED_VOLCANOES.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('追加した火山は座標がインドネシア周辺の範囲(南緯12〜北緯2度・東経95〜128度)に収まる', () => {
    NEW_VOLCANO_IDS.forEach((id) => {
      const v = SHARED_VOLCANOES.find((x) => x.id === id);
      expect(v, id + ' が見つからない').toBeDefined();
      expect(v!.lat, id + ' の緯度が範囲外').toBeGreaterThan(-12);
      expect(v!.lat, id + ' の緯度が範囲外').toBeLessThan(2);
      expect(v!.lon, id + ' の経度が範囲外').toBeGreaterThan(95);
      expect(v!.lon, id + ' の経度が範囲外').toBeLessThan(128);
    });
  });

  it('既存の5件(メラピ・クラカタウ・シナブン・スメル・アグン)が改変・重複なく残っている', () => {
    const existingIds = ['merapi', 'krakatau', 'sinabung', 'semeru', 'agung'];
    existingIds.forEach((id) => {
      const matches = SHARED_VOLCANOES.filter((v) => v.id === id);
      expect(matches, id + ' が重複または欠落').toHaveLength(1);
    });
  });
});

describe('活断層ページ用の埋め込みデータ(webglFaults.ts)も共有データと同期している', () => {
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

  it('新規追加したインドネシアの断層・火山idが埋め込み配列にも存在する', () => {
    const html = getWebGLFaultsPage('tester');
    [...NEW_FAULT_IDS, ...NEW_VOLCANO_IDS].forEach((id) => {
      expect(html).toContain("id:'" + id + "'");
    });
  });
});
