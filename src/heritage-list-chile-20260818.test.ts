import { describe, it, expect } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

// 対象: 世界遺産リスト(HERITAGE_LIST)のチリの項目。
// チリのUNESCO世界遺産は単独資産6件+トランスバウンダリー資産1件
// (カパック・ニャン、アルゼンチン/ボリビア/チリ/コロンビア/エクアドル/ペルー)。
// 既存データには「フンボルト・ペンギン国立保護区」(y:2021)という誤った
// 項目が入っていたため、2021年にチリで実際に登録された「チンチョーロ文化の
// 集落と人工ミイラ化」に修正し、欠落していたチロエの教会群(2000年)・
// セウェル鉱山都市(2006年)・カパック・ニャン(2014年、資産共有)を追加した。
//
// 故障シナリオ:
//   (1) 実在しない「フンボルト・ペンギン国立保護区」がy:2021のまま残る
//       (Humboldt Penguin National Reserveは暫定リストのみでUNESCO正式
//       登録はされていない)
//   (2) チロエの教会群・セウェル鉱山都市・カパック・ニャンが重複追加される
//   (3) 座標が実際の資産位置から大きくずれる

describe('世界遺産リスト: チリ', () => {
  const chileOwn = HERITAGE_LIST.filter((h) => h.f === '🇨🇱');

  it('チリ単独資産が6件登録されている(ラパ・ヌイ・ハンバーストーン・バルパライソ・チロエ・セウェル・チンチョーロ)', () => {
    expect(chileOwn).toHaveLength(6);
  });

  it('実在しない「フンボルト・ペンギン国立保護区」は含まれない', () => {
    expect(chileOwn.some((h) => h.n.includes('フンボルト'))).toBe(false);
  });

  it('チンチョーロ文化の集落と人工ミイラ化が座標・登録年(2021)付きで登録されている', () => {
    const entry = chileOwn.find((h) => h.n.includes('チンチョーロ'));
    expect(entry).toBeDefined();
    expect(entry!.y).toBe(2021);
    expect(entry!.lat).toBeCloseTo(-18.48, 1);
    expect(entry!.lon).toBeCloseTo(-70.30, 1);
  });

  it('チロエの教会群が座標・登録年(2000)付きで追加されている', () => {
    const entry = chileOwn.find((h) => h.n.includes('チロエ'));
    expect(entry).toBeDefined();
    expect(entry!.y).toBe(2000);
    expect(entry!.lat).toBeCloseTo(-42.48, 1);
    expect(entry!.lon).toBeCloseTo(-73.76, 1);
  });

  it('セウェル鉱山都市が座標・登録年(2006)付きで追加されている', () => {
    const entry = chileOwn.find((h) => h.n.includes('セウェル'));
    expect(entry).toBeDefined();
    expect(entry!.y).toBe(2006);
    expect(entry!.lat).toBeCloseTo(-34.07, 1);
    expect(entry!.lon).toBeCloseTo(-70.38, 1);
  });

  it('カパック・ニャン(アンデス山脈の道路網)がチリを含む資産共有国表記・登録年(2014)付きで追加されている', () => {
    const entry = HERITAGE_LIST.find((h) => h.n.includes('カパック・ニャン'));
    expect(entry).toBeDefined();
    expect(entry!.y).toBe(2014);
    expect(entry!.c).toContain('チリ');
  });

  it('国旗絵文字はすべて🇨🇱で統一されている', () => {
    expect(chileOwn.every((h) => h.f === '🇨🇱')).toBe(true);
  });
});
