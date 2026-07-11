import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

// 対象: 世界遺産ページのHERITAGE_LISTに追加する「世界一美しい」とされる
// ノルウェー北部ロフォーテン諸島のヘニングスヴェール・スタジアム(サッカー場)。
// UNESCO世界遺産ではないため、ンゴング競馬場と同じ規約(y:'----')に従い
// 登録年を「----年」(非世界遺産の例外データ)として扱う。
describe('HERITAGE_LIST — ノルウェーのヘニングスヴェール・スタジアム', () => {
  it('⚽アイコンと調査した座標でヘニングスヴェール・スタジアムを含む', () => {
    const site = HERITAGE_LIST.find((item) => item.n === 'ヘニングスヴェール・スタジアム');

    expect(site).toMatchObject({
      e: '⚽',
      f: '🇳🇴',
      c: 'ノルウェー',
      t: 'サッカー場',
      y: '----',
      lat: 68.148,
      lon: 14.2007,
    });
  });

  it('世界遺産ではない例外データとして登録年が「----」になっている(ンゴング競馬場と同じ規約)', () => {
    const site = HERITAGE_LIST.find((item) => item.n === 'ヘニングスヴェール・スタジアム');
    expect(site).toBeDefined();
    expect(site!.y).toBe('----');
  });
});
