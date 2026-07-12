import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

// 対象: イタリアの世界遺産リスト。前回追加した「ドムス・デ・ジャナス」
// (2025)・「北アペニン山脈の石膏カルストと洞窟群」(2023)に続き、
// 複数の独立ソースで裏取りできた5件を追加する:
//   - モンテ・エトナ(自然遺産, 2013)
//   - モンテ・サン・ジョルジョ(自然遺産, 2010・スイスとの越境資産)
//   - ロンゴバルド族の権力の場所群(文化遺産, 2011・7構成資産)
//   - トスカーナのメディチ家別荘群と庭園群(文化遺産, 2013・14構成資産)
//   - アルブラ・ベルニナ線のレーティッシュ鉄道(文化遺産, 2008・スイスとの越境資産)
// これでイタリアの自然遺産は6件(公式と一致)になる。文化遺産は
// 公式55件に対し1件不足が残るが、この環境ではWebFetchが全面的に
// ブロックされており確実な裏取りができなかったため追加していない。
describe('HERITAGE_LIST — イタリアの追加世界遺産5件(2008-2013年登録)', () => {
  const italyHeritages = HERITAGE_LIST.filter((item) => item.f === '🇮🇹');

  it('モンテ・エトナ(2013・自然遺産)を含む', () => {
    const site = italyHeritages.find((item) => item.n.includes('エトナ'));
    expect(site).toBeDefined();
    expect(site).toMatchObject({ t: '自然遺産', y: 2013 });
    expect(site!.lat).toBeCloseTo(37.7551, 1);
    expect(site!.lon).toBeCloseTo(14.9952, 1);
  });

  it('モンテ・サン・ジョルジョ(2010・自然遺産)を含む', () => {
    const site = italyHeritages.find((item) => item.n.includes('サン・ジョルジョ'));
    expect(site).toBeDefined();
    expect(site).toMatchObject({ t: '自然遺産', y: 2010 });
  });

  it('ロンゴバルド族の権力の場所群(2011・文化遺産)を含む', () => {
    const site = italyHeritages.find((item) => item.n.includes('ロンゴバルド'));
    expect(site).toBeDefined();
    expect(site).toMatchObject({ t: '文化遺産', y: 2011 });
  });

  it('トスカーナのメディチ家別荘群と庭園群(2013・文化遺産)を含む', () => {
    const site = italyHeritages.find((item) => item.n.includes('メディチ家別荘'));
    expect(site).toBeDefined();
    expect(site).toMatchObject({ t: '文化遺産', y: 2013 });
  });

  it('アルブラ・ベルニナ線のレーティッシュ鉄道(2008・文化遺産)を含む', () => {
    const site = italyHeritages.find((item) => item.n.includes('レーティッシュ鉄道'));
    expect(site).toBeDefined();
    expect(site).toMatchObject({ t: '文化遺産', y: 2008 });
  });

  it('追加後、イタリアの自然遺産は公式統計と一致する6件になる', () => {
    const naturalCount = italyHeritages.filter((item) => item.t === '自然遺産').length;
    expect(naturalCount).toBe(6);
  });

  it('追加した5件は座標がイタリア国内(自国+越境資産のイタリア側)の妥当な範囲(北緯35-47度・東経6-19度)にある', () => {
    const names = ['エトナ', 'サン・ジョルジョ', 'ロンゴバルド', 'メディチ家別荘', 'レーティッシュ鉄道'];
    const sites = italyHeritages.filter((item) => names.some((n) => item.n.includes(n)));
    expect(sites).toHaveLength(5);
    for (const item of sites) {
      expect(item.lat).toBeGreaterThan(35);
      expect(item.lat).toBeLessThan(47);
      expect(item.lon).toBeGreaterThan(6);
      expect(item.lon).toBeLessThan(19);
    }
  });
});
