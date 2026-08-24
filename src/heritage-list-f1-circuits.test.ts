import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';
import { F1_CIRCUITS } from './data/f1Circuits';

// 対象: 世界遺産ページ(HERITAGE_LIST)へのF1開催サーキットの追加。
// F1開催地はUNESCO世界遺産ではないため、ンゴング競馬場・ヘニングスヴェール・
// スタジアムと同じ規約(y:'----')に従って追加する。既存の世界遺産と近接する
// (=「足りない」わけではない)サーキットは対象外とする方針だったが、実データ
// (haversine距離)で検証した結果すべてのサーキットが最寄りの世界遺産から
// 5km以上離れており、全22件が追加対象だった。
// 故障シナリオ:
//   (1) 座標の桁を誤って転記する
//   (2) y に数値を入れてしまいUNESCO世界遺産と誤認される
//   (3) F1_CIRCUITSに存在するサーキットが1件でも欠落する
//   (4) 重複追加してしまう

describe('HERITAGE_LIST — F1開催サーキット', () => {
  it('F1_CIRCUITSの全サーキットがHERITAGE_LISTに存在する', () => {
    for (const c of F1_CIRCUITS) {
      const site = HERITAGE_LIST.find((item) => item.n === c.circuit);
      expect(site, `${c.circuit} がHERITAGE_LISTに見つからない`).toBeDefined();
    }
  });

  it('追加したサーキットはすべてy:"----"(UNESCO世界遺産ではない)で、F1_CIRCUITSと同じ座標・flagを持つ', () => {
    for (const c of F1_CIRCUITS) {
      const site = HERITAGE_LIST.find((item) => item.n === c.circuit)!;
      expect(site).toMatchObject({
        e: '🏎️',
        f: c.flag,
        t: 'F1サーキット',
        y: '----',
        lat: c.lat,
        lon: c.lon,
      });
    }
  });

  it('マドリング・サーキットをスペインの登録年なしの地点として表示する', () => {
    expect(HERITAGE_LIST.find((item) => item.n === 'マドリング・サーキット')).toMatchObject({
      f: '🇪🇸',
      c: 'スペイン',
      y: '----',
      lat: 40.4650,
      lon: -3.6089,
    });
  });

  it('重複追加されていない(サーキット名の重複が無い)', () => {
    const f1Names = new Set(F1_CIRCUITS.map((c) => c.circuit));
    const matches = HERITAGE_LIST.filter((item) => f1Names.has(item.n));
    expect(matches.length).toBe(f1Names.size);
  });

  it('F1_CIRCUITSの件数(22件)ぶんが追加されている', () => {
    expect(F1_CIRCUITS.length).toBe(22);
    const f1Names = new Set(F1_CIRCUITS.map((c) => c.circuit));
    const matches = HERITAGE_LIST.filter((item) => item.t === 'F1サーキット');
    expect(matches.length).toBe(f1Names.size);
  });
});
