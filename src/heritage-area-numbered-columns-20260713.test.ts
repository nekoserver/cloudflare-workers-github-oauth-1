import { describe, expect, it } from 'vitest';
import { getHeritageAreaPage } from './views/heritageArea';

// 対象: heritage-areaページの「検索露出ログ検索結果」(#results-matched)テーブル。
// 従来の「エリア」列(番号をカンマ区切りで1セルに表示)を廃止し、
// AIチャット質問列の右側に1〜20のエリア番号ごとの列を並べ、
// 該当するエリア番号の列に✅を表示する。各エリア番号のTh見出しをクリックすると
// そのエリア番号のチェックが入った行だけに絞り込む(再クリックで解除)。
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
  return new Function(`${src}\nreturn { state, areaNumbersOf, renderMatchedRows, renderUnmatchedRows };`)();
}

describe('heritage-areaページ: 検索露出ログ検索結果テーブルのエリア番号1〜20列化', () => {
  const html = getHeritageAreaPage();

  it('theadはAIチャット質問列の右側に1〜20のエリア番号列を持つ(エリア列は廃止)', () => {
    const theadMatch = html.match(/<thead><tr><th>AIチャット質問<\/th>((?:<th[^>]*>\d+<\/th>){20})<\/tr><\/thead><tbody id="results-matched"/);
    expect(theadMatch).not.toBeNull();
    expect(html).not.toMatch(/<th[^>]*>エリア<\/th><th>AIチャット質問<\/th>/);
  });

  it('20列の各Thはarea-col-thクラスとdata-area-num属性を持ちクリック可能', () => {
    for (let n = 1; n <= 20; n++) {
      const re = new RegExp('<th class="area-col-th" data-area-num="' + n + '"[^>]*>' + n + '</th>');
      expect(html).toMatch(re);
    }
  });

  it('renderMatchedRowsは名前列を先頭に、該当エリア番号の列に✅を表示する', () => {
    const { renderMatchedRows } = loadFns(html);
    const rows = [
      { item_name: 'ウルビーノ歴史地区', impression_count: 338, area_matches: [{ key: 'ウルビーノ歴史地区', areas: 'エリア#1/heritage-access (box)' }] },
      { item_name: 'ヴァルカモニカの岩絵', impression_count: 527, area_matches: [] },
    ];
    const out = renderMatchedRows(rows);
    expect(out).toContain('ウルビーノ歴史地区');
    expect(out).not.toContain('ヴァルカモニカの岩絵');
    const nameIdx = out.indexOf('ウルビーノ歴史地区');
    const checkIdx = out.indexOf('✅');
    expect(checkIdx).toBeGreaterThan(nameIdx);
    // 20列分のtdがあり、そのうち1つだけ✅
    const tdCount = (out.match(/<td/g) || []).length;
    expect(tdCount).toBe(21); // 名前列1 + 20エリア列
    const checkCount = (out.match(/✅/g) || []).length;
    expect(checkCount).toBe(1);
  });

  it('複数エリア番号にマッチする行は該当する全列に✅を表示する', () => {
    const { renderMatchedRows } = loadFns(html);
    const rows = [
      { item_name: 'X', impression_count: 1, area_matches: [{ key: 'x', areas: 'エリア#1/a (box) / エリア#3/b (box2)' }] },
    ];
    const out = renderMatchedRows(rows);
    const checkCount = (out.match(/✅/g) || []).length;
    expect(checkCount).toBe(2);
  });

  it('エリア登録済みテーブルが空の場合はcolspan=21で表示する(20列+名前列)', () => {
    const { renderMatchedRows } = loadFns(html);
    const out = renderMatchedRows([{ item_name: 'A', impression_count: 1, area_matches: [] }]);
    expect(out).toContain('colspan="21"');
  });

  it('renderEmpty/renderLoadingもresults-matchedにはcolspan=21を使う', () => {
    expect(html).toMatch(/results-matched'\)\.innerHTML='<tr><td colspan="21" class="empty">/);
    expect(html).toMatch(/results-matched'\)\.innerHTML='<tr><td colspan="21" class="loading-row">/);
  });

  it('scan()のエラー時もresults-matchedにはcolspan=21を使う', () => {
    const idx = html.indexOf('async function scan()');
    const block = html.slice(idx, idx + 1200);
    expect(block).toContain('colspan="21"');
  });

  it('area-col-thクリックでsetAreaFilterを呼び、同じ番号を再クリックすると解除する(トグル)', () => {
    expect(html).toContain('function setAreaFilter(');
    const idx = html.indexOf('function setAreaFilter(');
    const block = html.slice(idx, idx + 400);
    expect(block).toContain('state.areaFilter');
    expect(block).toMatch(/state\.areaFilter\s*=\s*\(?state\.areaFilter\s*===\s*n/);
    expect(block).toContain('renderMatchedRows');
  });

  it('area-col-thには初期表示時にクリックハンドラが登録される', () => {
    const idx = html.indexOf("querySelectorAll('.area-col-th').forEach(th=>{th.addEventListener");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 200);
    expect(block).toContain('setAreaFilter(');
  });

  it('renderMatchedRowsはstate.areaFilterが設定されている場合、該当列に✅がある行だけに絞り込む', () => {
    const { renderMatchedRows, state } = loadFns(html);
    const rows = [
      { item_name: 'Alpha遺跡', impression_count: 1, area_matches: [{ key: 'a', areas: 'エリア#1/x (box)' }] },
      { item_name: 'Beta遺跡', impression_count: 1, area_matches: [{ key: 'b', areas: 'エリア#2/x (box)' }] },
    ];
    state.areaFilter = '2';
    const out = renderMatchedRows(rows);
    expect(out).not.toContain('Alpha遺跡');
    expect(out).toContain('Beta遺跡');
  });
});
