import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

describe('HERITAGE_LIST — スペイン アルハフェリア宮殿(アラゴンのムデハル様式建築)', () => {
  it('アラゴンのムデハル様式建築(アルハフェリア宮殿ほか)を1件含む', () => {
    const sites = HERITAGE_LIST.filter((site) => site.c === 'スペイン' && site.n.includes('アラゴンのムデハル様式建築'));
    expect(sites).toHaveLength(1);
    expect(sites[0].n).toContain('アルハフェリア宮殿');
    expect(sites[0].y).toBe(1986);
  });

  it('座標はサラゴサ(アルハフェリア宮殿の所在地)を指す', () => {
    const site = HERITAGE_LIST.find((s) => s.c === 'スペイン' && s.n.includes('アラゴンのムデハル様式建築'));
    expect(site).toBeDefined();
    expect(site!.lat).toBeCloseTo(41.65, 1);
    expect(site!.lon).toBeCloseTo(-0.91, 1);
  });

  it('重複登録されていない（同一のUNESCO登録を二重にカウントしない）', () => {
    const aljaferiaLike = HERITAGE_LIST.filter((site) =>
      site.n.includes('アルハフェリア') || site.n.includes('アラゴンのムデハル様式建築')
    );
    expect(aljaferiaLike).toHaveLength(1);
  });
});
