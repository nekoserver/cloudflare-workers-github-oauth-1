import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getHeritageAreaPage } from './views/heritageArea';
import { HERITAGE_AREA_SEARCH_TOPICS } from './index';

// heritageArea.ts に埋め込まれたscriptから、DOM(document)に依存しない純粋関数
// (esc/areaNumbersOf/renderMatchedRows/renderUnmatchedRows)だけを抽出して実行し、
// テーブル分割・エリア番号表示ロジックの実際の挙動を検証する。
function extractPureFunctions(html: string): string {
  const lines = html.split('\n');
  const prefixes = ['const esc=', 'let gemmaCache=', 'const state=', 'function areaNumbersOf(', 'function distancePrefix(', 'function mitokoroIconsHtml(', 'function resultNameHtml(', 'function renderMatchedRows(', 'function renderUnmatchedRows('];
  const found = prefixes.map((prefix) => lines.find((line) => line.startsWith(prefix)));
  if (found.some((line) => !line)) {
    throw new Error('必要な関数が生成HTMLから見つからない');
  }
  return found.join('\n');
}

function loadFns(html: string) {
  const src = extractPureFunctions(html);
  return new Function(`${src}\nreturn { areaNumbersOf, renderMatchedRows, renderUnmatchedRows };`)();
}

describe('heritage-area page', () => {
  it('renders Travel category buttons, multi-select keywords, and result table placeholders', () => {
    const html = getHeritageAreaPage();
    expect(html).toContain('Heritage Area');
    expect(html).toContain('/api/heritage-area/travel-categories');
    expect(html).toContain('/api/heritage-area/search');
    expect(html).toContain('複数選択可');
    expect(html).toContain('keyword-drawer');
    expect(html).toContain('id="keyword-search"');
    expect(html).toContain('renderMatchedRows');
    expect(html).toContain('renderUnmatchedRows');
    expect(html).toContain('検索露出ログ検索結果');
    expect(html).toContain('AIチャット検索露出ログ');
    expect(html).toContain('露出回数');
    expect(html).toContain('AIチャット質問');
    expect(html).toContain('エリア未登録（露出回数順）');
    expect(html).toContain('class="spinner"');
    expect(html).toContain('kw-flag');
    expect(html).toContain('distance-prefix');
    expect(html).toContain('heritage_point');
  });

  it('エリア登録済みテーブルはAIチャット質問列が先頭にあり、右側に1〜20のエリア番号列を持つ(エリア列(単一セル)は廃止)', () => {
    const html = getHeritageAreaPage();
    const theadMatch = html.match(/<thead><tr><th>AIチャット質問<\/th>(?:<th[^>]*>\d+<\/th>){20}<\/tr><\/thead><tbody id="results-matched"/);
    expect(theadMatch).not.toBeNull();
  });

  it('areaNumbersOf: エリア番号のみを「#」無しで抽出する', () => {
    const html = getHeritageAreaPage();
    const { areaNumbersOf } = loadFns(html);
    expect(areaNumbersOf({ area_matches: [{ key: 'ウルビーノ歴史地区', areas: 'エリア#1/heritage-access (box)' }] })).toBe('1');
    expect(areaNumbersOf({ area_matches: [] })).toBe('');
    expect(areaNumbersOf({ area_matches: [{ key: 'x', areas: 'エリア#1/heritage-access (box) / エリア#2/other (box2)' }] })).toBe('1, 2');
  });

  it('renderMatchedRows: エリア番号のある行のみを、AIチャット質問列+エリア番号1〜20列(✅)で表示する', () => {
    const html = getHeritageAreaPage();
    const { renderMatchedRows } = loadFns(html);
    const rows = [
      { item_name: 'ウルビーノ歴史地区', impression_count: 338, area_matches: [{ key: 'ウルビーノ歴史地区', areas: 'エリア#1/heritage-access (box)' }] },
      { item_name: 'ヴァルカモニカの岩絵', impression_count: 527, area_matches: [] },
    ];
    const html2 = renderMatchedRows(rows);
    expect(html2).toContain('ウルビーノ歴史地区');
    expect(html2).not.toContain('ヴァルカモニカの岩絵');
    expect((html2.match(/✅/g) || []).length).toBe(1);
    expect(html2).not.toContain('338');
  });

  it('renderUnmatchedRows: エリア番号の無い行だけを露出回数の多い順で表示する', () => {
    const html = getHeritageAreaPage();
    const { renderUnmatchedRows } = loadFns(html);
    const rows = [
      { item_name: 'A', impression_count: 100, area_matches: [] },
      { item_name: 'B', impression_count: 500, area_matches: [] },
      { item_name: 'C', impression_count: 300, area_matches: [{ key: 'C', areas: 'エリア#1/heritage-access (box)' }] },
    ];
    const html2 = renderUnmatchedRows(rows);
    const idxB = html2.indexOf('B');
    const idxA = html2.indexOf('A');
    expect(idxB).toBeGreaterThanOrEqual(0);
    expect(idxA).toBeGreaterThan(idxB);
    expect(html2).not.toContain('>C<');
  });

  it('renderUnmatchedRows: 距離がある行はkmを先頭に出して近い順で表示する', () => {
    const html = getHeritageAreaPage();
    const { renderUnmatchedRows } = loadFns(html);
    const rows = [
      { item_name: '遠い世界遺産', impression_count: 999, distance_km: 1200, area_matches: [] },
      { item_name: '近い世界遺産', impression_count: 1, distance_km: 80, area_matches: [] },
    ];
    const html2 = renderUnmatchedRows(rows);
    expect(html2).toContain('<span class="distance-prefix">80km</span>');
    expect(html2.indexOf('近い世界遺産')).toBeLessThan(html2.indexOf('遠い世界遺産'));
  });

  it('registers heritage-area route and API handlers', () => {
    const src = readFileSync('src/index.ts', 'utf8');
    expect(src).toContain("app.get('/heritage-area'");
    expect(src).toContain("app.get('/api/heritage-area/travel-categories'");
    expect(src).toContain("app.get('/api/heritage-area/travel-categories/:id/keywords'");
    expect(src).toContain("app.post('/api/heritage-area/search'");
    expect(src).toContain('FROM aichat_search_impressions i');
    expect(src).toContain("'aichat_search_impressions' AS category");
    expect(src).toContain('const topics = HERITAGE_AREA_SEARCH_TOPICS');
    expect(src).toContain("(INSTR(REPLACE(s.question, '･', '・'), ?) > 0 OR INSTR(REPLACE(s.answer, '･', '・'), ?) > 0)");
    expect(src).toContain('const firstQuoteMatch = question.match(/「([^」]+)」/)');
    expect(src).toContain('itemByQuoteKey');
    expect(src).toContain('item_name: firstQuoteKey');
    expect(src).toContain('const areaLookup = db.prepare');
    expect(src).toContain('for (const key of item.quote_keys)');
    expect(src).toContain('FROM heritage_area_items i');
    expect(src).toContain('OR INSTR(?, i.item_name) > 0');
    expect(src).toContain('area_matches');
    expect(src).toContain('findHeritageAreaPoint');
    expect(src).toContain('distance_origin');
    expect(src).toContain('distance_km');
  });
});
