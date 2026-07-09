import { describe, it, expect } from 'vitest';
import { countKeywordHitsInText } from './index';

describe('countKeywordHitsInText: 見どころモーダル内キーワードヒット数', () => {
  it('回答本文に含まれるキーワードだけをdistinctで数える', () => {
    const result = countKeywordHitsInText('タージ・マハルは白大理石と庭園が見どころです。白大理石が有名です。', [
      '白大理石',
      '庭園',
      '白大理石',
      '鉄道',
      '',
    ]);
    expect(result.hitCount).toBe(2);
    expect(result.keywords).toEqual(['白大理石', '庭園']);
  });

  it('空本文や空キーワードではゼロ件を返す', () => {
    expect(countKeywordHitsInText('', ['白大理石']).hitCount).toBe(0);
    expect(countKeywordHitsInText('本文', []).keywords).toEqual([]);
  });
});
