import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

describe('HERITAGE_LIST — ヘレンキームゼー城(ドイツ)', () => {
  it('ヘレンキームゼー城が登録年2025年・文化遺産として存在する', () => {
    const site = HERITAGE_LIST.find((s) => s.n === 'ヘレンキームゼー城');
    expect(site).toBeTruthy();
    expect(site!.c).toBe('ドイツ');
    expect(site!.t).toBe('文化遺産');
    expect(site!.y).toBe(2025);
    expect(site!.md).toBe('07-12');
  });

  it('座標がヘレンキームゼー島付近(北緯47.87度・東経12.33度付近)を指す', () => {
    const site = HERITAGE_LIST.find((s) => s.n === 'ヘレンキームゼー城');
    expect(site).toBeTruthy();
    expect(site!.lat).toBeCloseTo(47.8766, 1);
    expect(site!.lon).toBeCloseTo(12.3258, 1);
  });

  it('同時登録された「ルートヴィヒ2世のバイエルン王宮群」の他3件(ノイシュヴァンシュタイン城・リンダーホーフ城)も同じ2025年登録', () => {
    const neuschwanstein = HERITAGE_LIST.find((s) => s.n === 'ノイシュヴァンシュタイン城');
    const linderhof = HERITAGE_LIST.find((s) => s.n === 'リンダーホーフ城');
    expect(neuschwanstein!.y).toBe(2025);
    expect(linderhof!.y).toBe(2025);
  });
});
