import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

describe('HERITAGE_LIST — イラン・パキスタン世界遺産', () => {
  it('イランの世界遺産27件をすべて含む(UNESCO公式27件)', () => {
    const sites = HERITAGE_LIST.filter((site) => site.c === 'イラン');
    const names = sites.map((site) => site.n);

    expect(sites).toHaveLength(27);
    expect(names).toEqual(expect.arrayContaining([
      'ペルセポリス',
      'チョガー・ザンビール',
      'イマーム広場（イスファハーン）',
      'タフテ・ソレイマーン',
      'バムとその文化的景観',
      'パサルガダエ',
      'ソルターニーイェ',
      'ビーソトゥーン',
      'イランのアルメニア人修道院群',
      'シューシュタルの歴史的水利システム',
      'シャイフ・サフィー・アッディーンの聖廟建築群（アルダビール）',
      'タブリーズの歴史的バザール複合施設',
      'ペルシャ式庭園',
      'イスファハーンのマスジェデ・ジャーメ',
      'ゴンバデ・カーブース',
      'ゴレスターン宮殿',
      'シャフレ・スーフテ（焼けた町）',
      'メイマンドの文化的景観',
      'スーサ',
      'ペルシャのカナート',
      'ルート砂漠',
      'ヤズドの歴史都市',
      'ファールス地方のサーサーン朝考古学的景観',
      'ヒルカニア森林群',
      'ウラマーナート（ハウラマーン）の文化的景観',
      'トランス・イラン鉄道',
      'ペルシャのキャラバンサライ',
    ]));
  });

  it('パキスタンの世界遺産6件をすべて含む(UNESCO公式6件)', () => {
    const sites = HERITAGE_LIST.filter((site) => site.c === 'パキスタン');
    const names = sites.map((site) => site.n);

    expect(sites).toHaveLength(6);
    expect(names).toEqual(expect.arrayContaining([
      'モヘンジョダロ',
      'タキシラ',
      'タフテ・バーヒーの仏教遺跡とサハリー・バハロールの周辺遺跡',
      'マクリーの史跡群（タッタ）',
      'ラホール城とシャーラマール庭園',
      'ロータス砦',
    ]));
  });

  it('イラン・パキスタンの各サイトは有効な緯度経度を持つ', () => {
    const sites = HERITAGE_LIST.filter((site) => site.c === 'イラン' || site.c === 'パキスタン');
    sites.forEach((site) => {
      expect(site.lat).toBeGreaterThanOrEqual(-90);
      expect(site.lat).toBeLessThanOrEqual(90);
      expect(site.lon).toBeGreaterThanOrEqual(-180);
      expect(site.lon).toBeLessThanOrEqual(180);
      expect(typeof site.y).toBe('number');
    });
  });
});
