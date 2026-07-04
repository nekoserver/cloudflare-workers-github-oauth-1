import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

describe('HERITAGE_LIST — ボスニア・ヘルツェゴビナ世界遺産', () => {
  it('ボスニア単独の世界遺産3件をすべて含む(モスタル橋・ヴィシェグラード橋・ヴィェトレニツァ洞窟)', () => {
    const sites = HERITAGE_LIST.filter((site) => site.c === 'ボスニア・ヘルツェゴビナ');
    const names = sites.map((site) => site.n);

    expect(sites).toHaveLength(3);
    expect(names).toEqual(expect.arrayContaining([
      'モスタル旧市街の古橋地域',
      'ヴィシェグラードのメフメト・パシャ・ソコロヴィッチ橋',
      'ヴィェトレニツァ洞窟',
    ]));
  });

  it('越境遺産(ステチャク中世墓地群・ブナ原生林)にもボスニアが含まれる', () => {
    const stecci = HERITAGE_LIST.find((s) => s.n === 'ステチャク中世墓地群');
    expect(stecci).toBeTruthy();
    expect(stecci!.c).toContain('ボスニア・ヘルツェゴビナ');

    const beech = HERITAGE_LIST.find((s) => s.n === 'カルパティア山脈とヨーロッパ各地のブナ原生林（ボスニア・ヘルツェゴビナ）');
    expect(beech).toBeTruthy();
    expect(beech!.c).toContain('ボスニア・ヘルツェゴビナ');
  });
});

describe('HERITAGE_LIST — デンマーク世界遺産（グリーンランドを含む）', () => {
  it('デンマーク本土の世界遺産8件をすべて含む(既存のイェリング遺跡1件+新規7件)', () => {
    const sites = HERITAGE_LIST.filter((site) => site.c === 'デンマーク');
    const names = sites.map((site) => site.n);

    expect(sites).toHaveLength(8);
    expect(names).toEqual(expect.arrayContaining([
      'イェリング遺跡',
      'ロスキレ大聖堂',
      'クロンボー城',
      'ステウンス・クリント',
      'クリスチャンスフェル（モラヴィア教会入植地）',
      '北シェラン島のパーフォース狩猟景観',
      'ヴァイキング時代の環状要塞群',
      'モーンス・クリント',
    ]));
  });

  it('グリーンランド(デンマーク自治領)の世界遺産3件をすべて含む', () => {
    const sites = HERITAGE_LIST.filter((site) => site.c === 'デンマーク（グリーンランド）');
    const names = sites.map((site) => site.n);

    expect(sites).toHaveLength(3);
    expect(names).toEqual(expect.arrayContaining([
      'クヤータ（グリーンランドのノース人とイヌイットの農耕地）',
      'アシヴィスイット＝ニピサット（氷床と海の間のイヌイット狩猟場）',
      'イルリサット・アイスフィヨルド',
    ]));
  });

  it('ワッデン海（デンマーク）は越境遺産として登録済み', () => {
    const site = HERITAGE_LIST.find((s) => s.n === 'ワッデン海（デンマーク）');
    expect(site).toBeTruthy();
    expect(site!.c).toContain('デンマーク');
    expect(site!.t).toBe('自然遺産');
  });

  it('グリーンランドの遺産も国旗はデンマーク(🇩🇰)を使う(他の海外領土の表記慣習と統一)', () => {
    const greenlandSites = HERITAGE_LIST.filter((site) => site.c === 'デンマーク（グリーンランド）');
    greenlandSites.forEach((site) => {
      expect(site.f).toBe('🇩🇰');
    });
  });
});
