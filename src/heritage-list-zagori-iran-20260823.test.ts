import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';
import { buildHeritageMasterRows } from './utils/heritage-master-seed';

describe('ザゴリ文化的景観の所在地', () => {
  const entries = HERITAGE_LIST.filter((item) => item.n === 'ザゴリ文化的景観');

  it('イラン・ファールス州の代表座標として登録されている', () => {
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      f: '🇮🇷',
      c: 'イラン',
      lat: 28.85,
      lon: 52.57,
    });
  });

  it('heritage_masterのシード行にも同じ国と座標が反映される', () => {
    const row = buildHeritageMasterRows(HERITAGE_LIST).find(
      (item) => item.heritage_name === 'ザゴリ文化的景観',
    );
    expect(row).toMatchObject({
      flag: '🇮🇷',
      country_name: 'イラン',
      lat: 28.85,
      lon: 52.57,
    });
  });
});
