import { describe, it, expect } from 'vitest';
import { ccToJp, buildCountryHeritageCitiesHtml } from './webglHeritageUtils';

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
