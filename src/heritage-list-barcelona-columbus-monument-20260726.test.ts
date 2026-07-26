import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

// 対象: HERITAGE_LIST の「コロンブスの記念塔(コロン広場)」(バルセロナ)。
//
// 背景: バルセロナの世界遺産はガウディ建築群(1984)とパラウ・デ・ラ・ムシカ・カタラーナ/
// サン・パウ病院(1997)の2件のみで、コロン広場のコロンブス記念塔(Mirador de Colom)は
// UNESCO世界遺産には含まれない(公式のバルセロナ内訳9件はすべてガウディ7作品+
// ドメネク・イ・モンタネール2作品で構成され、記念塔は含まれない)。
// 非世界遺産の観光名所として、既存の競馬場(ンゴング競馬場)・サッカー場
// (ヘニングスヴェール・スタジアム)・F1サーキット群と同じ y:'----' の扱いで追加した。
//
// 故障シナリオ:
//   (1) 誤って文化遺産/自然遺産/複合遺産として登録され、UNESCO非登録の事実と矛盾する
//   (2) 座標がバルセロナの範囲外(緯度経度の入れ違い・符号ミス)
//   (3) 既存のバルセロナのUNESCO登録2件(ガウディ建築群・パラウ/サン・パウ病院)と
//       重複・混同される

const HERITAGE_TYPES = new Set(['文化遺産', '自然遺産', '複合遺産']);

describe('HERITAGE_LIST — コロンブスの記念塔(コロン広場・バルセロナ)', () => {
  it('コロンブスの記念塔が1件登録されている', () => {
    const items = HERITAGE_LIST.filter((h) => h.n === 'コロンブスの記念塔(コロン広場)');
    expect(items).toHaveLength(1);
  });

  it('登録年は"----"(世界遺産ではない)であり、UNESCO種別(文化/自然/複合遺産)を名乗らない', () => {
    const item = HERITAGE_LIST.find((h) => h.n === 'コロンブスの記念塔(コロン広場)')!;
    expect(item.y).toBe('----');
    expect(HERITAGE_TYPES.has(item.t)).toBe(false);
  });

  it('国旗🇪🇸・国名スペインが設定されている', () => {
    const item = HERITAGE_LIST.find((h) => h.n === 'コロンブスの記念塔(コロン広場)')!;
    expect(item.f).toBe('🇪🇸');
    expect(item.c).toBe('スペイン');
  });

  it('座標がバルセロナ市内の範囲に収まっている(北緯41.3〜41.5度・東経2.0〜2.3度)', () => {
    const item = HERITAGE_LIST.find((h) => h.n === 'コロンブスの記念塔(コロン広場)')!;
    expect(item.lat).toBeGreaterThan(41.3);
    expect(item.lat).toBeLessThan(41.5);
    expect(item.lon).toBeGreaterThan(2.0);
    expect(item.lon).toBeLessThan(2.3);
  });

  it('既存のバルセロナのUNESCO世界遺産2件(ガウディ建築群・パラウ/サン・パウ病院)とは別エントリである', () => {
    const gaudi = HERITAGE_LIST.find((h) => h.n === 'バルセロナのガウディ建築群');
    const palau = HERITAGE_LIST.find((h) => h.n === 'バルセロナのパラウ・デ・ラ・ムシカ・カタラーナとサン・パウ病院');
    const monument = HERITAGE_LIST.find((h) => h.n === 'コロンブスの記念塔(コロン広場)');
    expect(gaudi).toBeDefined();
    expect(palau).toBeDefined();
    expect(monument).toBeDefined();
    expect(gaudi!.y).toBe(1984);
    expect(palau!.y).toBe(1997);
    expect(HERITAGE_TYPES.has(gaudi!.t)).toBe(true);
    expect(HERITAGE_TYPES.has(palau!.t)).toBe(true);
  });
});
