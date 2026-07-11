import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';

// 対象: 世界遺産ページのエリアメニュー「巡回」ボタンから開く左サイドパネルの
// 空港キンドの行頭表示。
// - 空港周辺の世界遺産が記録済み(hasAirportHeritageSet)の場合: "⛳️✈︎国旗..." の順
// - 未記録の場合: "✈︎国旗..." の順(デフォルト)
// 国旗はitemLabelの都市名(a.city)先頭に元々埋め込まれているため、
// itemIcon側では「(⛳️ if 記録済み) + ✈︎」だけを返せば、行全体としては
// [itemIcon][itemLabel] = "⛳️✈︎ 国旗 都市 空港名(コード)" の順になる。
describe('世界遺産エリア巡回サイドパネル: 空港行のアイコン順序', () => {
  const html = getWebGLHeritagePage('tester');

  it('空港kindのitemIconは記録済みなら⛳️を先頭に付けたうえで✈︎を返す(未記録は✈︎のみ)', () => {
    const idx = html.indexOf("key: 'airport'");
    expect(idx).toBeGreaterThan(-1);
    const endIdx = html.indexOf('\n    }', idx);
    const block = html.slice(idx, endIdx);
    expect(block).toContain("itemIcon: function(a) { return (hasAirportHeritageSet[a.name] ? '⛳️ ' : '') + '✈︎'; }");
  });

  it('itemLabelは国旗を含む都市名をそのまま返す(itemIcon側に⛳️を出したためlabel側には追加しない)', () => {
    const idx = html.indexOf("key: 'airport'");
    const endIdx = html.indexOf('\n    }', idx);
    const block = html.slice(idx, endIdx);
    expect(block).toContain("itemLabel: function(a) { return a.city + ' ' + a.name + ' (' + a.code + ')'; }");
  });
});
