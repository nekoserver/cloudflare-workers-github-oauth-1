import { describe, it, expect } from 'vitest';
import { getWebGLFaultsPage } from './views/webglFaults';
import { VOLCANOES as SHARED_VOLCANOES } from './data/volcanoes';

// 対象: 活断層ページ(/webgl-faults)の日本国内の活火山データ
// (src/data/volcanoes.ts の VOLCANOES 配列、および src/views/webglFaults.ts に
// 埋め込まれた同期用の複製配列)。気象庁が定める日本の活火山111のうち、既存5件
// (桜島・阿蘇山・富士山・新燃岳(霧島)・西之島)以外に83件を追加し、日本国内88件とした。
//
// 追加対象は北海道(北方領土内11火山を除く)・東北・関東中部・伊豆小笠原(一部の深海
// 海底火山を除く)・九州山口・沖縄の各地方。北方領土内11火山および伊豆・小笠原の
// 一部の深海海底火山(海形海山・海徳海山・噴火浅根・北福徳堆・南日吉海山・日光海山)は
// 信頼できる座標情報を確認できなかったため、今回は追加を見送った。
//
// 故障シナリオ:
//   (1) src/data/volcanoes.ts にのみ追加し、webglFaults.ts の埋め込み配列への
//       同期を忘れる(このページはdata/volcanoes.tsをimportしておらず、埋め込み
//       配列が実際の表示に使われるため、同期漏れがあると画面に反映されない)
//   (2) id が重複し、既存火山(海外含む)と衝突する
//   (3) 座標が日本の範囲外(緯度経度の入れ違い・符号ミス)
//   (4) 既存の5件(桜島・阿蘇山・富士山・新燃岳・西之島)が重複して二重登録される

describe('活断層ページ 日本国内の活火山追加', () => {
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

  it('日本の活火山が88件登録されている(既存5件+新規83件、重複なし)', () => {
    const jp = SHARED_VOLCANOES.filter((v) => v.c === '日本');
    const names = jp.map((v) => v.n);
    expect(new Set(names).size).toBe(names.length);
    expect(jp.length).toBe(88);
  });

  it('既存の5件(桜島・阿蘇山・富士山・新燃岳（霧島）・西之島)が改変・重複なく残っている', () => {
    const jp = SHARED_VOLCANOES.filter((v) => v.c === '日本');
    const existingIds = ['sakurajima', 'asosan', 'fujisan', 'shinmoedake', 'nishino'];
    existingIds.forEach((id) => {
      const matches = jp.filter((v) => v.id === id);
      expect(matches, id + ' が重複または欠落').toHaveLength(1);
    });
  });

  it('VOLCANOES 配列内で id が重複していない(全世界の火山データ全体で)', () => {
    const ids = SHARED_VOLCANOES.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('日本の活火山は全件、座標が日本のおおよその範囲内(北緯20〜46度・東経122〜154度)に収まる', () => {
    const jp = SHARED_VOLCANOES.filter((v) => v.c === '日本');
    for (const v of jp) {
      expect(v.lat, v.id + ' の緯度が範囲外').toBeGreaterThan(20);
      expect(v.lat, v.id + ' の緯度が範囲外').toBeLessThan(46);
      expect(v.lon, v.id + ' の経度が範囲外').toBeGreaterThan(122);
      expect(v.lon, v.id + ' の経度が範囲外').toBeLessThan(154);
    }
  });

  it('新規追加した代表的な火山(御嶽山・有珠山・雲仙岳・伊豆大島・十和田)が含まれる', () => {
    const jp = SHARED_VOLCANOES.filter((v) => v.c === '日本');
    const ids = jp.map((v) => v.id);
    ['ontakesan', 'usuzan', 'unzendake', 'izu_oshima', 'towada'].forEach((id) => {
      expect(ids, id + ' が見つからない').toContain(id);
    });
  });
});

describe('活断層ページ用の埋め込みデータ(webglFaults.ts)も共有データと同期している', () => {
  it('webglFaults.ts の VOLCANOES 配列と共有データの件数が一致する（同期漏れの検知）', () => {
    const html = getWebGLFaultsPage('tester');
    const start = html.indexOf('var VOLCANOES = [');
    expect(start).toBeGreaterThan(-1);
    const end = html.indexOf('\n  ];', start);
    const block = html.slice(start, end);
    const inlineCount = (block.match(/id:'/g) || []).length;
    expect(inlineCount).toBe(SHARED_VOLCANOES.length);
  });

  it('新規追加した日本の火山idが埋め込み配列にも存在する', () => {
    const html = getWebGLFaultsPage('tester');
    ['shiretoko_iozan', 'ontakesan', 'usuzan', 'unzendake', 'izu_oshima', 'suwanosejima', 'io_torishima'].forEach((id) => {
      expect(html).toContain("id:'" + id + "'");
    });
  });
});
