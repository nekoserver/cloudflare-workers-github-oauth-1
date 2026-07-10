import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

// 対象: src/data/heritageList.ts のキルギスの世界遺産データ。
// UNESCO世界遺産センターの登録データ(2026年時点で3件: スレイマン山、
// シルクロード：長安－天山回廊の交易路網、西天山)のうち、シルクロードと
// 西天山(いずれもカザフスタン・ウズベキスタンとの越境シリアル物件)の
// キルギス側構成資産が未登録だったため追加した。
describe('HERITAGE_LIST — キルギス世界遺産', () => {
  it('UNESCO世界遺産リスト掲載のキルギス3件をすべて含む', () => {
    const kyrgyzHeritage = HERITAGE_LIST.filter((item) => item.c === 'キルギス');
    const names = kyrgyzHeritage.map((item) => item.n);

    expect(names).toEqual(expect.arrayContaining([
      'スレイマン山',
      'シルクロード：長安－天山回廊の交易路網（キルギス）',
      '西天山（キルギス）',
    ]));
    expect(kyrgyzHeritage).toHaveLength(3);
  });

  it('キルギス世界遺産の登録年・種別・座標が正しく設定されている', () => {
    const byName = (n: string) => HERITAGE_LIST.find((item) => item.c === 'キルギス' && item.n === n);

    const sulaiman = byName('スレイマン山');
    expect(sulaiman).toBeDefined();
    expect(sulaiman!.y).toBe(2009);
    expect(sulaiman!.t).toBe('複合遺産');

    const silkRoad = byName('シルクロード：長安－天山回廊の交易路網（キルギス）');
    expect(silkRoad).toBeDefined();
    expect(silkRoad!.y).toBe(2014);
    expect(silkRoad!.t).toBe('文化遺産');
    expect(silkRoad!.lat).toBeCloseTo(42.75, 1);
    expect(silkRoad!.lon).toBeCloseTo(75.25, 1);

    const tienShan = byName('西天山（キルギス）');
    expect(tienShan).toBeDefined();
    expect(tienShan!.y).toBe(2016);
    expect(tienShan!.t).toBe('自然遺産');
    expect(tienShan!.lat).toBeCloseTo(41.89, 1);
    expect(tienShan!.lon).toBeCloseTo(71.96, 1);
  });

  it('キルギス世界遺産の座標がすべて有効な数値である', () => {
    const kyrgyzHeritage = HERITAGE_LIST.filter((item) => item.c === 'キルギス');
    expect(kyrgyzHeritage.length).toBeGreaterThan(0);
    for (const item of kyrgyzHeritage) {
      expect(Number.isFinite(item.lat)).toBe(true);
      expect(Number.isFinite(item.lon)).toBe(true);
    }
  });
});
