import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

// 対象: 世界遺産ページ(HERITAGE_LIST)へのワラリキ・ビーチ（アーチウェイ諸島）の
// 追加。Windows既定のロック画面写真として有名な、ニュージーランド南島
// Golden Bay近郊の海食洞から見えるアーチウェイ諸島。UNESCO世界遺産ではない
// ため、ンゴング競馬場・F1サーキット群と同じ規約(y:'----')に従って追加する。
//
// 故障シナリオ:
//   (1) yに数値を入れてしまいUNESCO世界遺産と誤認される
//   (2) 座標の桁を誤って転記する(南半球なのに正のlatになっている等)
//   (3) 国旗がニュージーランド(🇳🇿)になっていない

describe('HERITAGE_LIST — ワラリキ・ビーチ（アーチウェイ諸島）', () => {
  it('HERITAGE_LISTに1件だけ存在し、UNESCO世界遺産ではないy:"----"・ニュージーランド国旗を持つ', () => {
    const matches = HERITAGE_LIST.filter((item) => item.n === 'ワラリキ・ビーチ（アーチウェイ諸島）');
    expect(matches.length).toBe(1);
    expect(matches[0]).toMatchObject({
      f: '🇳🇿',
      c: 'ニュージーランド',
      y: '----',
    });
  });

  it('南半球の座標(負のlat)になっている', () => {
    const site = HERITAGE_LIST.find((item) => item.n === 'ワラリキ・ビーチ（アーチウェイ諸島）')!;
    expect(site.lat).toBeLessThan(0);
    expect(site.lon).toBeGreaterThan(0);
  });
});
