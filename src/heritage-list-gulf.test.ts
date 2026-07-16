import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

describe('HERITAGE_LIST — サウジアラビア・UAE・カタール・バーレーン世界遺産', () => {
  // 登録年が '----'(表示上は「----年」)のエントリは UNESCO 世界遺産ではなく、
  // 意図的に登録された例外的なデータ(F1サーキットなど)として扱う。
  const isUnescoHeritage = (item: { y: number | '----' }) => item.y !== '----';

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

  it('UAEの世界遺産1件を含む(既存で登録済み・追加不要。F1サーキット等の非UNESCO例外データは対象外)', () => {
    const sites = HERITAGE_LIST.filter((site) => site.c === 'UAE' && isUnescoHeritage(site));
    const names = sites.map((site) => site.n);

    expect(sites).toHaveLength(1);
    expect(names).toEqual(expect.arrayContaining([
      'アル・アインのオアシス群',
    ]));
  });

  it('カタールの世界遺産1件を含む(F1サーキット等の非UNESCO例外データは対象外)', () => {
    const sites = HERITAGE_LIST.filter((site) => site.c === 'カタール' && isUnescoHeritage(site));
    const names = sites.map((site) => site.n);

    expect(sites).toHaveLength(1);
    expect(names).toEqual(expect.arrayContaining([
      'アル・ズバラ考古遺跡',
    ]));
  });

  it('バーレーンの世界遺産3件をすべて含む(UNESCO公式全件)', () => {
    const sites = HERITAGE_LIST.filter((site) => site.c === 'バーレーン');
    const names = sites.map((site) => site.n);

    expect(sites).toHaveLength(3);
    expect(names).toEqual(expect.arrayContaining([
      'バーレーン要塞（カラート・アル・バーレーン）',
      '真珠採り：島の経済の証',
      'ディルムン墳墓群',
    ]));
  });
});
