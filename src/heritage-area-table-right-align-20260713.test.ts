import { describe, expect, it } from 'vitest';
import { getHeritageAreaPage } from './views/heritageArea';

// 対象: heritage-areaページの検索露出ログ検索結果テーブル(.area-table)。
// エリア番号th群が常に画面(テーブル)の右端に来るよう、テーブル全体をwidth:100%にし、
// エリア番号列は固定幅のまま右側に並べ、AIチャット質問列は残り幅いっぱいに広がる
// (固定260pxではなくmin-widthのみ)ようにする。
describe('heritage-areaページ: 検索結果テーブルのエリア番号列を右寄せしAIチャット質問列を可変幅にする', () => {
  const html = getHeritageAreaPage();

  it('.area-tableはtable-layout:fixedかつwidth:100%でテーブル全体を親要素いっぱいに広げる', () => {
    expect(html).toMatch(/\.area-table\{[^}]*table-layout:fixed/);
    expect(html).toMatch(/\.area-table\{[^}]*width:100%/);
    expect(html).not.toMatch(/\.area-table\{[^}]*width:auto/);
  });

  it('AIチャット質問列(先頭列)は固定width(260px)を持たずmin-widthのみで残り幅いっぱいに広がる', () => {
    expect(html).not.toMatch(/\.area-table th:first-child,\.area-table td:first-child\{[^}]*width:260px/);
    expect(html).toMatch(/\.area-table th:first-child,\.area-table td:first-child\{[^}]*min-width:\d+px/);
  });

  it('エリア番号列(area-col-th/area-col-td)は引き続き固定幅を持つ(右側に固定サイズで並べるため)', () => {
    expect(html).toMatch(/\.area-col-th\{[^}]*width:26px/);
    expect(html).toMatch(/\.area-col-td\{[^}]*width:26px/);
  });

  it('エリア番号列は共通th,td paddingを上書きして狭いpaddingにし、width:26pxが実際にその通りの幅になるようにする(2桁の番号でも26px幅に収まるように)', () => {
    expect(html).toMatch(/\.area-col-th\{[^}]*padding:6px 2px/);
    expect(html).toMatch(/\.area-col-td\{[^}]*padding:6px 2px/);
  });
});
