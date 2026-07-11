import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';

// 対象: 世界遺産ページのエリアメニュー「巡回」ボタンから開く左サイドパネルの
// 空港キンドの行頭表示。従来は種別アイコン(✈︎)が先、国旗(ピン)がラベル内に
// 埋め込まれて後から表示されていたため、行頭に国旗が来るよう順序を入れ替える。
describe('世界遺産エリア巡回サイドパネル: 空港行のアイコン順序', () => {
  const html = getWebGLHeritagePage('tester');

  it('空港kindのitemIconは国旗を先頭にして✈︎を続ける(ピンが行頭に来る)', () => {
    const idx = html.indexOf("key: 'airport'");
    expect(idx).toBeGreaterThan(-1);
    const endIdx = html.indexOf('\n    }', idx);
    const block = html.slice(idx, endIdx);
    expect(block).toContain("itemIcon: function(a) { return a.city.split(' ')[0] + ' ✈︎'; }");
  });

  it('itemLabelは国旗が二重表示されないよう都市名以降のみを返し、記録済み空港の⛳️マーカーは維持する', () => {
    const idx = html.indexOf("key: 'airport'");
    const endIdx = html.indexOf('\n    }', idx);
    const block = html.slice(idx, endIdx);
    expect(block).toContain("itemLabel: function(a) { return (hasAirportHeritageSet[a.name] ? '⛳️ ' : '') + a.city.split(' ').slice(1).join(' ') + ' ' + a.name + ' (' + a.code + ')'; }");
  });
});
