import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

describe('HERITAGE_LIST — シャッハン離宮(ドイツ)', () => {
  it('シャッハン離宮が登録年2025年・文化遺産として存在する', () => {
    const site = HERITAGE_LIST.find((s) => s.n === 'シャッハン離宮');
    expect(site).toBeTruthy();
    expect(site!.c).toBe('ドイツ');
    expect(site!.t).toBe('文化遺産');
    expect(site!.y).toBe(2025);
    expect(site!.md).toBe('07-12');
  });

  it('座標が実際のシャッハン(ガルミッシュ＝パルテンキルヒェン近郊、北緯47.42度・東経11.11度付近)を指す', () => {
    const site = HERITAGE_LIST.find((s) => s.n === 'シャッハン離宮');
    expect(site).toBeTruthy();
    expect(site!.lat).toBeCloseTo(47.4197, 1);
    expect(site!.lon).toBeCloseTo(11.1126, 1);
  });

  it('同時登録された「ルートヴィヒ2世のバイエルン王宮群」の他3件(ノイシュヴァンシュタイン城・リンダーホーフ城・ヘレンキームゼー城)も同じ2025年登録', () => {
    const neuschwanstein = HERITAGE_LIST.find((s) => s.n === 'ノイシュヴァンシュタイン城');
    const linderhof = HERITAGE_LIST.find((s) => s.n === 'リンダーホーフ城');
    const herrenchiemsee = HERITAGE_LIST.find((s) => s.n === 'ヘレンキームゼー城');
    expect(neuschwanstein!.y).toBe(2025);
    expect(linderhof!.y).toBe(2025);
    expect(herrenchiemsee!.y).toBe(2025);
  });
});
