import { describe, expect, it } from 'vitest';
import { getHeritageAreaPage } from './views/heritageArea';

// 対象: heritage-areaページの「検索露出ログ検索結果」(#results-matched)テーブル。
// 従来の「エリア」列(番号をカンマ区切りで1セルに表示)を廃止し、
// AIチャット質問列の右側にデータベース上の実際の最大エリア番号(state.maxAreaNum)ぶんの
// 列を動的に並べ、該当するエリア番号の列に✅を表示する。各エリア番号のTh見出しを
// クリックするとそのエリア番号のチェックが入った行だけに絞り込む(再クリックで解除)。
// 列は静的HTMLに焼き込まれず、ページ読み込み後にJS(renderAreaColumnHeaders)が
// /api/heritage-area/max-area-seqの取得結果を使って動的に描画する。
function extractPureFunctions(html: string): string {
  const lines = html.split('\n');
  const prefixes = ['const esc=', 'let gemmaCache=', 'const state=', 'function areaNumbersOf(', 'function distancePrefix(', 'function mitokoroIconsHtml(', 'function resultNameHtml(', 'function matchedColspan(', 'function renderMatchedRows(', 'function renderUnmatchedRows('];
  const found = prefixes.map((prefix) => lines.find((line) => line.startsWith(prefix)));
  if (found.some((line) => !line)) {
    throw new Error('必要な関数が生成HTMLから見つからない');
  }
  return found.join('\n');
}

function loadFns(html: string) {
  const src = extractPureFunctions(html);
  return new Function(`${src}\nreturn { state, areaNumbersOf, matchedColspan, renderMatchedRows, renderUnmatchedRows };`)();
}

describe('heritage-areaページ: 検索露出ログ検索結果テーブルのエリア番号列(state.maxAreaNumぶん動的生成)化', () => {
  const html = getHeritageAreaPage();

  it('静的HTMLのtheadはAIチャット質問列のみで、エリア番号列は含まない(JSで動的追加するため)', () => {
    const theadMatch = html.match(/<thead><tr id="results-matched-head-row"><th>AIチャット質問<\/th><\/tr><\/thead><tbody id="results-matched"/);
    expect(theadMatch).not.toBeNull();
    expect(html).not.toMatch(/<th[^>]*>エリア<\/th><th>AIチャット質問<\/th>/);
  });

  it('renderAreaColumnHeadersはstate.maxAreaNum本のarea-col-thをdata-area-num属性付きで描画する', () => {
    const { state } = loadFns(html);
    const idx = html.indexOf('function renderAreaColumnHeaders(');
    const block = html.slice(idx, idx + 700);
    expect(block).toContain("Array.from({length:state.maxAreaNum}");
    expect(block).toContain('area-col-th');
    expect(block).toContain("data-area-num=");
    expect(state.maxAreaNum).toBe(0);
  });

  it('renderMatchedRowsは名前列を先頭に、state.maxAreaNum本のarea-col-td列を持ち、該当エリア番号の列に✅を表示する', () => {
    const { state, renderMatchedRows } = loadFns(html);
    state.maxAreaNum = 20;
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
    const tdCount = (out.match(/<td/g) || []).length;
    expect(tdCount).toBe(21); // 名前列1 + 20エリア列
    const checkCount = (out.match(/✅/g) || []).length;
    expect(checkCount).toBe(1);
  });

  it('state.maxAreaNumを変えるとrenderMatchedRowsの列数もそれに追従する', () => {
    const { state, renderMatchedRows } = loadFns(html);
    state.maxAreaNum = 3;
    const rows = [{ item_name: 'X', impression_count: 1, area_matches: [{ key: 'x', areas: 'エリア#1/a (box)' }] }];
    const out = renderMatchedRows(rows);
    const tdCount = (out.match(/<td/g) || []).length;
    expect(tdCount).toBe(4); // 名前列1 + 3エリア列
  });

  it('複数エリア番号にマッチする行は該当する全列に✅を表示する', () => {
    const { state, renderMatchedRows } = loadFns(html);
    state.maxAreaNum = 5;
    const rows = [
      { item_name: 'X', impression_count: 1, area_matches: [{ key: 'x', areas: 'エリア#1/a (box) / エリア#3/b (box2)' }] },
    ];
    const out = renderMatchedRows(rows);
    const checkCount = (out.match(/✅/g) || []).length;
    expect(checkCount).toBe(2);
  });

  it('matchedColspanはstate.maxAreaNum+1を返し、結果が空の場合そのcolspanで表示する', () => {
    const { state, matchedColspan, renderMatchedRows } = loadFns(html);
    state.maxAreaNum = 5;
    expect(matchedColspan()).toBe(6);
    const out = renderMatchedRows([{ item_name: 'A', impression_count: 1, area_matches: [] }]);
    expect(out).toContain('colspan="6"');
  });

  it('renderEmpty/renderLoadingもmatchedColspan()を使う(固定値ではない)', () => {
    expect(html).toMatch(/results-matched'\)\.innerHTML='<tr><td colspan="'\+matchedColspan\(\)\+'" class="empty">/);
    expect(html).toMatch(/results-matched'\)\.innerHTML='<tr><td colspan="'\+matchedColspan\(\)\+'" class="loading-row">/);
  });

  it('scan()のエラー時もmatchedColspan()を使う(固定値ではない)', () => {
    const idx = html.indexOf('async function scan()');
    const block = html.slice(idx, idx + 1200);
    expect(block).toContain('matchedColspan()');
    expect(block).not.toContain('colspan="21"');
  });

  it('area-col-thクリックでsetAreaFilterを呼び、同じ番号を再クリックすると解除する(トグル、カテゴリ選択中のみ)', () => {
    expect(html).toContain('function setAreaFilter(');
    const idx = html.indexOf('function setAreaFilter(');
    const block = html.slice(idx, idx + 400);
    expect(block).toContain('state.areaFilter');
    expect(block).toMatch(/state\.areaFilter\s*=\s*\(?state\.areaFilter\s*===\s*n/);
    expect(block).toContain('renderMatchedRows');
  });

  it('renderAreaColumnHeaderで生成されたarea-col-thには動的にクリックハンドラが登録される', () => {
    const idx = html.indexOf('function renderAreaColumnHeaders(');
    const block = html.slice(idx, idx + 700);
    expect(block).toContain("querySelectorAll('.area-col-th').forEach(th=>{th.addEventListener");
    expect(block).toContain('setAreaFilter(');
  });

  it('renderMatchedRowsはstate.areaFilterが設定されている場合、該当列に✅がある行だけに絞り込む', () => {
    const { renderMatchedRows, state } = loadFns(html);
    state.maxAreaNum = 5;
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
