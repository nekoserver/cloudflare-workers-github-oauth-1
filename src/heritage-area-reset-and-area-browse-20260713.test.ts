import { describe, expect, it } from 'vitest';
import { getHeritageAreaPage } from './views/heritageArea';

// 対象: heritage-areaページのツールバー(#toolbar-cat-select)。
// 「カテゴリ選択…」(空値)を選び直すと表示中のキーワード/国旗ボタンが全て消えて
// リセットされ、この状態でも検索結果テーブルのエリア番号列見出しをタップすると
// キーワード検索を経由せずそのエリアに保存済みのアイテムを直接一覧表示する。
// またエリア番号列の本数はデータベース上の実際の最大エリア番号(state.maxAreaNum)に
// 追従し、15を超える場合はテーブル幅を固定してスクロールしないと見えないようにする。
function extractFn(html: string, name: string, len = 500): string {
  const idx = html.indexOf(name);
  expect(idx).toBeGreaterThan(-1);
  return html.slice(idx, idx + len);
}

describe('heritage-areaページ: ツールバーのリセット + エリア番号列の直接ブラウズ', () => {
  const html = getHeritageAreaPage();

  it('静的HTMLのthead(#results-matched-head-row)は初期状態でAIチャット質問列のみを持つ(エリア番号列はJSで動的追加)', () => {
    const theadMatch = html.match(/<thead><tr id="results-matched-head-row"><th>AIチャット質問<\/th><\/tr><\/thead><tbody id="results-matched"/);
    expect(theadMatch).not.toBeNull();
  });

  it('resetToolbarSelection関数が存在し、カテゴリ・キーワード・選択状態・結果行・エリア絞り込みをリセットする', () => {
    const block = extractFn(html, 'function resetToolbarSelection(');
    expect(block).toContain('state.catId=null');
    expect(block).toContain('state.keywords=[]');
    expect(block).toContain('state.selected.clear()');
    expect(block).toContain('state.areaFilter=null');
    expect(block).toContain('renderFlagToolbar()');
  });

  it('ツールバーのカテゴリ選択で空値(プレースホルダー)を選ぶとresetToolbarSelectionを呼ぶ', () => {
    const idx = html.indexOf('function renderToolbarCategorySelect(');
    const block = html.slice(idx, idx + 500);
    expect(block).toContain('resetToolbarSelection()');
  });

  it('browseArea関数が存在し、/api/heritage-area/areas/{n}/itemsを取得してresults-matchedへ描画する', () => {
    const block = extractFn(html, 'async function browseArea(', 900);
    expect(block).toContain("'/api/heritage-area/areas/'+n+'/items'");
    expect(block).toContain('renderMatchedRows(rows)');
  });

  it('browseAreaは同じエリア番号を再タップすると絞り込みを解除する(トグル)', () => {
    const block = extractFn(html, 'async function browseArea(', 900);
    expect(block).toContain('state.browsingArea');
  });

  it('setAreaFilterはカテゴリ未選択(state.catIdが無い)時はbrowseAreaを呼び、選択中は従来通りrenderMatchedRowsで絞り込む', () => {
    const block = extractFn(html, 'function setAreaFilter(', 400);
    expect(block).toContain('if(!state.catId){browseArea(n);return;}');
    expect(block).toContain('renderMatchedRows(state.rows||[])');
  });

  it('matchedColspan関数がstate.maxAreaNum+1を返し、renderEmpty/renderLoading/renderMatchedRowsがこれを使う', () => {
    expect(html).toContain('function matchedColspan()');
    const idx = html.indexOf('function matchedColspan()');
    const block = html.slice(idx, idx + 100);
    expect(block).toContain('state.maxAreaNum+1');
    const emptyIdx = html.indexOf('function renderEmpty(');
    expect(html.slice(emptyIdx, emptyIdx + 300)).toContain('matchedColspan()');
    const loadingIdx = html.indexOf('function renderLoading(');
    expect(html.slice(loadingIdx, loadingIdx + 300)).toContain('matchedColspan()');
    const renderMatchedIdx = html.indexOf('function renderMatchedRows(');
    expect(html.slice(renderMatchedIdx, renderMatchedIdx + 500)).toContain('matchedColspan()');
  });

  it('scan()のエラー時もmatchedColspan()を使う', () => {
    const idx = html.indexOf('async function scan()');
    const block = html.slice(idx, idx + 1200);
    expect(block).toContain('matchedColspan()');
  });

  it('loadMaxAreaNum関数が/api/heritage-area/max-area-seqを取得しstate.maxAreaNumへ反映、renderAreaColumnHeadersを呼ぶ', () => {
    const block = extractFn(html, 'async function loadMaxAreaNum(', 400);
    expect(block).toContain("/api/heritage-area/max-area-seq");
    expect(block).toContain('state.maxAreaNum=');
    expect(block).toContain('renderAreaColumnHeaders()');
  });

  it('renderAreaColumnHeadersはstate.maxAreaNum本のarea-col-thを#results-matched-head-rowへ描画しクリックハンドラを登録する', () => {
    const block = extractFn(html, 'function renderAreaColumnHeaders(', 600);
    expect(block).toContain("getElementById('results-matched-head-row')");
    expect(block).toContain('state.maxAreaNum');
    expect(block).toContain('area-col-th');
    expect(block).toContain('setAreaFilter(');
  });

  it('applyAreaTableWidthCapはstate.maxAreaNumが15を超える場合のみ#results-matched-wrapへmax-widthを設定する', () => {
    const block = extractFn(html, 'function applyAreaTableWidthCap(', 400);
    expect(block).toContain("getElementById('results-matched-wrap')");
    expect(block).toMatch(/state\.maxAreaNum\s*>\s*15/);
  });

  it('renderAreaColumnHeadersはヘッダ描画後にapplyAreaTableWidthCapを呼ぶ', () => {
    const block = extractFn(html, 'function renderAreaColumnHeaders(', 600);
    expect(block).toContain('applyAreaTableWidthCap()');
  });

  it('検索結果テーブル(results-matched)のtable-wrapにid="results-matched-wrap"が付与されている', () => {
    expect(html).toContain('id="results-matched-wrap"');
  });
});
