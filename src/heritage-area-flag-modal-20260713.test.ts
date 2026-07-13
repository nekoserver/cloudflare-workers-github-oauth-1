import { describe, expect, it } from 'vitest';
import { getHeritageAreaPage } from './views/heritageArea';

// 対象: heritage-areaページの国旗ドロップダウン(.flag-dd-menu)を、右肩に✕閉じるボタンを持つ
// モーダル(openMitokoroCacheModalと同じgetNextZ()パターン)に変更する。
describe('heritage-areaページ: 国旗ドロップダウンのモーダル化', () => {
  const html = getHeritageAreaPage();

  it('renderFlagToolbarはボタンのみを描画し、クリックでopenFlagKeywordsModalを呼ぶ', () => {
    expect(html).toContain('function renderFlagToolbar(');
    const idx = html.indexOf('function renderFlagToolbar(');
    const block = html.slice(idx, idx + 700);
    expect(block).toContain('flag-dd-btn');
    expect(block).toContain('openFlagKeywordsModal(');
    expect(block).not.toContain('flag-dd-menu');
  });

  it('openFlagKeywordsModal関数がgetNextZ()でz-indexを算出し、✕閉じるボタンを持つモーダルを生成する', () => {
    expect(html).toContain('function openFlagKeywordsModal(');
    const idx = html.indexOf('function openFlagKeywordsModal(');
    const block = html.slice(idx, idx + 2200);
    expect(block).toContain('getNextZ()');
    expect(block).toContain("position:fixed;inset:0");
    expect(block).toContain("textContent='✕'");
    expect(block).toContain("setAttribute('aria-label','閉じる')");
    expect(block).toContain('removeChild(overlay)');
  });

  it('モーダル内の各項目は「国旗」「(空港コード)」「空港名」「(出現回数)」の順で表示し、クリックでtoggleKeywordByNameを呼ぶ', () => {
    const idx = html.indexOf('function openFlagKeywordsModal(');
    const block = html.slice(idx, idx + 2200);
    expect(block).toContain("it.code?' ('+esc(it.code)+')':''");
    expect(block).toContain("esc(f.flag)+codePart+' '+esc(it.keyword)+' ('+Number(it.count||0)+')");
    expect(block).toContain('toggleKeywordByName(');
  });

  it('モーダルはオーバーレイクリックでも閉じる', () => {
    const idx = html.indexOf('function openFlagKeywordsModal(');
    const block = html.slice(idx, idx + 2200);
    expect(block).toContain('overlay.addEventListener(\'click\'');
  });

  it('旧来の絶対配置ドロップダウンCSS(.flag-dd-menu)は使用しない', () => {
    expect(html).not.toContain('.flag-dd-menu');
    expect(html).not.toContain('.flag-dd{');
  });
});
