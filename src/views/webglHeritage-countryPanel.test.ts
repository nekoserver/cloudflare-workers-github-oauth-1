import { describe, it, expect } from 'vitest';
import { ccToJp, buildCountryHeritageCitiesHtml } from './webglHeritageUtils';
import { getWebGLHeritagePage } from './webglHeritage';
import { HERITAGE_LIST } from '../data/heritageList';

describe('ccToJp', () => {
  it('既知の国コードをカタカナ名に変換する', () => {
    expect(ccToJp('IT')).toBe('イタリア');
    expect(ccToJp('CN')).toBe('中国');
    expect(ccToJp('JP')).toBe('日本');
    expect(ccToJp('FR')).toBe('フランス');
    expect(ccToJp('DE')).toBe('ドイツ');
    expect(ccToJp('ES')).toBe('スペイン');
  });

  it('未知の国コードはそのまま返す', () => {
    expect(ccToJp('ZZ')).toBe('ZZ');
    expect(ccToJp('')).toBe('');
  });
});

describe('buildCountryHeritageCitiesHtml', () => {
  const matches = [
    { n: '遺産A', e: '🏛️', y: 2000 },
    { n: '遺産B', e: '⛩️', y: 2010 },
    { n: '遺産C', e: '🗿', y: 1995 },
  ];

  it('年の新しい順に並べる（降順）', () => {
    const html = buildCountryHeritageCitiesHtml(matches as any, {}, 0);
    const pos2010 = html.indexOf('遺産B');
    const pos2000 = html.indexOf('遺産A');
    const pos1995 = html.indexOf('遺産C');
    expect(pos2010).toBeLessThan(pos2000);
    expect(pos2000).toBeLessThan(pos1995);
  });

  it('近隣都市数を表示する', () => {
    const cityCounts: Record<string, number> = { '遺産A': 5, '遺産B': 3 };
    const html = buildCountryHeritageCitiesHtml(matches as any, cityCounts, 10);
    expect(html).toContain('5');
    expect(html).toContain('3');
  });

  it('都市データがない遺産は「-」を表示する', () => {
    const html = buildCountryHeritageCitiesHtml(matches as any, {}, 0);
    expect(html).toContain('-');
  });

  it('最下段に重複なし都市合計を表示する', () => {
    const html = buildCountryHeritageCitiesHtml(matches as any, {}, 42);
    expect(html).toContain('42');
  });

  it('合計行が本文の最後に来る', () => {
    const html = buildCountryHeritageCitiesHtml(matches as any, { '遺産B': 3 }, 7);
    const posHeritage = html.lastIndexOf('遺産');
    const posTotal = html.indexOf('合計');
    expect(posTotal).toBeGreaterThan(posHeritage);
  });
});



describe('HERITAGE_LIST Austria coverage', () => {
  it('オーストリアの世界遺産12件を国別パネルに表示できるように保持する', () => {
    const austriaSites = HERITAGE_LIST.filter((site) => site.f === '🇦🇹');
    expect(austriaSites.map((site) => site.n)).toEqual(expect.arrayContaining([
      'ザルツブルク市街の歴史地区',
      'シェーンブルン宮殿と庭園群',
      'ハルシュタット＝ダッハシュタイン／ザルツカンマーグートの文化的景観',
      'ゼメリング鉄道',
      'グラーツ市街—歴史地区とエッゲンベルク城',
      'ヴァッハウ渓谷の文化的景観',
      'フェルテー湖／ノイジードラー湖の文化的景観',
      'ウィーン歴史地区',
      'アルプス山脈周辺の先史時代の杭上住居群（オーストリア）',
      'カルパティア山脈とヨーロッパ各地のブナ原生林（オーストリア）',
      'ローマ帝国の国境線—ドナウのリメス（西部分）',
      'ヨーロッパの大温泉保養都市群（バーデン・バイ・ウィーン）',
    ]));
    expect(austriaSites.length).toBeGreaterThanOrEqual(12);
  });
});

describe('世界遺産地球儀 エリアズーム', () => {
  it('エリアズーム用のボタン・選択オーバーレイ・エリアメニュー処理を含む', () => {
    const html = getWebGLHeritagePage('tester');
    expect(html).toContain('id="btnBoxZoom"');
    expect(html).toContain('id="box-select-overlay"');
    expect(html).toContain('function applyBoxZoom');
    expect(html).toContain('function screenToLatLon');
    expect(html).toContain('function getHeritagesInBounds');
    expect(html).toContain('エリアメニュー');
  });
});
