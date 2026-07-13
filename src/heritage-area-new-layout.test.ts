import { describe, expect, it } from 'vitest';
import { getHeritageAreaPage } from './views/heritageArea';

// 対象: heritage-areaページの新レイアウト(new_layout)。「Heritage Area」見出しの直下に
// ツールバーを設置し、最左に「Travel 中分類カテゴリ」相当のドロップダウンメニューを置く。
// カテゴリを選択すると既存実装どおり右サイドパネル(.keyword-drawer)にキーワードの
// 国旗・出現回数を表示しつつ、ツールバーのドロップダウン右側に国旗ごとの出現回数を
// 多い順の「国旗(出現回数)」ドロップダウンとして並べ、各ドロップダウン内に該当キーワードを
// 表示する。画面右上のトグルボタンでold_layout/new_layoutをいつでも切り替えられる。
function extractComputeFlagCounts(html: string): (keywords: { keyword: string; heritage_point?: { flag?: string } }[]) => { flag: string; count: number; keywords: string[] }[] {
  const idx = html.indexOf('function computeFlagCounts(');
  expect(idx).toBeGreaterThan(-1);
  const endIdx = html.indexOf('\n', idx);
  const src = html.slice(idx, endIdx);
  // eslint-disable-next-line no-new-func
  return new Function('return (' + src + ')')();
}

describe('heritage-areaページ: new_layout(ツールバー・国旗ドロップダウン・old/newトグル)', () => {
  const html = getHeritageAreaPage();

  it('script タグ内のJSに構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('「Heritage Area」見出しの直下にツールバー(カテゴリ選択ドロップダウン+国旗サマリ)を設置する', () => {
    expect(html).toContain('id="layout-toolbar"');
    expect(html).toContain('id="toolbar-cat-select"');
    expect(html).toContain('id="toolbar-flag-summary"');
    const h1Idx = html.indexOf('<h1>Heritage Area</h1>');
    const topCloseIdx = html.indexOf('</div>', h1Idx);
    const toolbarIdx = html.indexOf('id="layout-toolbar"');
    expect(h1Idx).toBeGreaterThan(-1);
    expect(toolbarIdx).toBeGreaterThan(h1Idx);
  });

  it('画面右上にold_layout/new_layoutを切り替えるトグルボタンがある(外部リンクではなくbutton)', () => {
    expect(html).toContain('id="layout-toggle-btn"');
    const idx = html.indexOf('id="layout-toggle-btn"');
    const tagStart = html.lastIndexOf('<', idx);
    const tag = html.slice(tagStart, tagStart + 20);
    expect(tag.startsWith('<button')).toBe(true);
  });

  it('new_layout時は.gridセクション(旧カテゴリchips)が隠れ、ツールバーが表示される(CSSクラス切替)', () => {
    expect(html).toMatch(/body\.layout-new\s+\.grid\s*\{[^}]*display:\s*none/);
    expect(html).toMatch(/body\.layout-new\s+\.layout-toolbar\s*\{[^}]*display:\s*flex/);
  });

  it('トグルボタンはlocalStorageで選択レイアウトを永続化する', () => {
    expect(html).toContain("localStorage.setItem('heritageAreaLayout'");
    expect(html).toContain("localStorage.getItem('heritageAreaLayout')");
  });

  it('ツールバーのカテゴリ選択はselectCategory()を再利用し、右サイドパネル(既存実装)への描画をそのまま流用する', () => {
    expect(html).toContain('function renderToolbarCategorySelect(');
    const idx = html.indexOf("getElementById('toolbar-cat-select')");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 300);
    expect(block).toContain('selectCategory(');
  });

  it('computeFlagCountsは国旗ごとに件数を集計し、多い順にソートする(純粋関数)', () => {
    const computeFlagCounts = extractComputeFlagCounts(html);
    const result = computeFlagCounts([
      { keyword: 'A空港', heritage_point: { flag: '🇮🇹' } },
      { keyword: 'B空港', heritage_point: { flag: '🇫🇷' } },
      { keyword: 'C空港', heritage_point: { flag: '🇮🇹' } },
      { keyword: 'D空港', heritage_point: { flag: '🇮🇹' } },
      { keyword: 'E空港' },
    ]);
    expect(result).toEqual([
      { flag: '🇮🇹', count: 3, keywords: ['A空港', 'C空港', 'D空港'] },
      { flag: '🇫🇷', count: 1, keywords: ['B空港'] },
    ]);
  });

  it('computeFlagCountsは国旗が無いキーワードを集計から除外する', () => {
    const computeFlagCounts = extractComputeFlagCounts(html);
    const result = computeFlagCounts([{ keyword: 'X' }, { keyword: 'Y' }]);
    expect(result).toEqual([]);
  });

  it('renderFlagToolbarはcomputeFlagCountsの結果を「国旗(出現回数)」の形式でドロップダウンボタンとして描画する', () => {
    expect(html).toContain('function renderFlagToolbar(');
    const idx = html.indexOf('function renderFlagToolbar(');
    const block = html.slice(idx, idx + 900);
    expect(block).toContain('computeFlagCounts(');
    expect(block).toContain('flag-dd-btn');
    expect(block).toMatch(/esc\(f\.flag\)\s*\+\s*'\('\s*\+\s*f\.count\s*\+\s*'\)/);
  });

  it('国旗ドロップダウン内の各キーワードクリックでtoggleKeywordByNameを呼び、右パネルと選択状態を同期する', () => {
    expect(html).toContain('function toggleKeywordByName(');
    const idx = html.indexOf('function toggleKeywordByName(');
    const block = html.slice(idx, idx + 400);
    expect(block).toContain('state.selected');
    expect(block).toContain('renderKeywords()');
    const flagIdx = html.indexOf('function renderFlagToolbar(');
    const flagBlock = html.slice(flagIdx, flagIdx + 1400);
    expect(flagBlock).toContain('toggleKeywordByName(');
  });

  it('renderKeywords()はキーワード再描画のたびにrenderFlagToolbar()も呼び、常に同期させる', () => {
    const idx = html.indexOf('function renderKeywords()');
    expect(idx).toBeGreaterThan(-1);
    const endIdx = html.indexOf('\n', idx) > -1 && html.slice(idx).indexOf('}el.querySelectorAll') > -1
      ? idx + html.slice(idx).indexOf('}el.querySelectorAll') + 1
      : idx + 2000;
    const block = html.slice(idx, endIdx + 200);
    expect(block).toContain('renderFlagToolbar()');
  });

  it('国旗ドロップダウンの開閉はgetNextZ()で最上位z-indexを動的算出する(CLAUDE.mdルール26準拠)', () => {
    expect(html).toContain('function getNextZ()');
    const idx = html.indexOf('function renderFlagToolbar(');
    const block = html.slice(idx, idx + 1400);
    expect(block).toContain('getNextZ()');
  });
});
