import { describe, expect, it } from 'vitest';
import { getHeritageAreaPage } from './views/heritageArea';

// 対象: heritage-areaページ全体のフォントサイズ・ボタン余白・ボタン間隔の圧縮。
// 画面密度を高めて情報量を増やすため、既存の値からひと回り小さい値に変更する。
describe('heritage-areaページ: フォントサイズ・ボタン余白・ボタン間隔の圧縮', () => {
  const html = getHeritageAreaPage();

  it('主要な文字サイズが従来よりひと回り小さくなっている', () => {
    expect(html).toMatch(/h1\{font-size:22px/);
    expect(html).toMatch(/\.section-title\{font-size:14px/);
    expect(html).toMatch(/\.chip\{[^}]*font-size:12px/);
    expect(html).toMatch(/th,td\{[^}]*font-size:12px/);
    expect(html).not.toMatch(/h1\{font-size:24px/);
    expect(html).not.toMatch(/\.section-title\{font-size:15px/);
  });

  it('ボタンのpaddingが従来より小さくなっている(.chip/.layout-toggle-btn/.drawer-toggle-btn/.flag-dd-btn)', () => {
    expect(html).toMatch(/\.chip\{[^}]*padding:5px 9px/);
    expect(html).toMatch(/\.layout-toggle-btn\{[^}]*padding:5px 10px/);
    expect(html).toMatch(/body\.layout-new \.drawer-toggle-btn\{[^}]*padding:5px 10px/);
    expect(html).toMatch(/\.flag-dd-btn\{[^}]*padding:4px 8px/);
  });

  it('ボタン同士の縦横の間隔(gap)が1pxまで狭くなっている(.chips/.toolbar-flag-summary/画面右上ボタン群)', () => {
    expect(html).toMatch(/\.chips\{[^}]*gap:1px/);
    expect(html).toMatch(/\.toolbar-flag-summary\{[^}]*gap:1px/);
    expect(html).toContain('style="display:flex;align-items:center;gap:1px"');
  });
});
