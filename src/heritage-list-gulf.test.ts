import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

describe('HERITAGE_LIST — サウジアラビア・UAE・カタール世界遺産', () => {
  it('サウジアラビアの世界遺産8件をすべて含む(UNESCO公式7件+既存登録済みの1件)', () => {
    const sites = HERITAGE_LIST.filter((site) => site.c === 'サウジアラビア');
    const names = sites.map((site) => site.n);

    expect(sites).toHaveLength(8);
    expect(names).toEqual(expect.arrayContaining([
      'ヘグラ（マダイン・サーレハ）',
      'ナジュラン/ウクデ文化的景観',
      'ヒマー文化地域',
      'アッ＝トライフ地区（ディライーヤ）',
      'ジッダ歴史地区',
      'ハイル地方の岩絵',
      'アル・アハサー・オアシス',
      'ウルーク・バニ・マアリド',
    ]));
  });

  it('UAEの世界遺産1件を含む(既存で登録済み・追加不要)', () => {
    const sites = HERITAGE_LIST.filter((site) => site.c === 'UAE');
    const names = sites.map((site) => site.n);

    expect(sites).toHaveLength(1);
    expect(names).toEqual(expect.arrayContaining([
      'アル・アインのオアシス群',
    ]));
  });

  it('カタールの世界遺産1件を含む', () => {
    const sites = HERITAGE_LIST.filter((site) => site.c === 'カタール');
    const names = sites.map((site) => site.n);

    expect(sites).toHaveLength(1);
    expect(names).toEqual(expect.arrayContaining([
      'アル・ズバラ考古遺跡',
    ]));
  });
});
