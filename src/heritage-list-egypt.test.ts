import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

describe('HERITAGE_LIST — エジプト世界遺産', () => {
  it('UNESCO世界遺産リスト掲載のエジプト7件をすべて含む', () => {
    const egyptSites = HERITAGE_LIST.filter((site) => site.c === 'エジプト');
    const names = egyptSites.map((site) => site.n);

    expect(egyptSites).toHaveLength(7);
    expect(names).toEqual(expect.arrayContaining([
      'ギザのピラミッド',
      'アブ・メナ',
      'ルクソール（古代テーベ）',
      'カイロ歴史地区',
      'アブ・シンベルからフィラエまでのヌビア遺跡群',
      '聖カタリナ地域',
      'ワディ・アル・ヒタン（クジラ渓谷）',
    ]));
  });
});
