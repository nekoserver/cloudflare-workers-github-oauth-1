import { describe, it, expect } from 'vitest';
import { getThreadTrackerPage } from './threadTracker';

describe('getThreadTrackerPage', () => {
  const html = getThreadTrackerPage('octocat');

  it('script タグ内の JS に構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  function extractModelRank(): (model: string) => number {
    const source = html.match(/function modelRank\(model\)\{([^}]*)\}/);
    expect(source).not.toBeNull();
    return new Function('model', source![1]) as (model: string) => number;
  }

  it('モデル色丸の表示順はQWEN→GEMMA4→Llama→その他(先に登場した順)になる', () => {
    const modelRank = extractModelRank();
    expect(typeof modelRank).toBe('function');
    const models = [
      '@cf/ibm-granite/granite-4.0-h-micro',
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      '@cf/google/gemma-4-26b-a4b-it',
      '@cf/qwen/qwen3.8-27b',
    ];
    const sorted = [...models].sort((a, b) => modelRank(a) - modelRank(b));
    expect(sorted).toEqual([
      '@cf/qwen/qwen3.8-27b',
      '@cf/google/gemma-4-26b-a4b-it',
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      '@cf/ibm-granite/granite-4.0-h-micro',
    ]);
  });

  it('該当モデルが一部しかなくても相対順序(QWEN→GEMMA4→Llama)は保たれる', () => {
    const modelRank = extractModelRank();
    const sorted = ['@cf/meta/llama-3.1-8b-instruct-fp8', '@cf/qwen/qwen3.8-27b'].sort((a, b) => modelRank(a) - modelRank(b));
    expect(sorted).toEqual(['@cf/qwen/qwen3.8-27b', '@cf/meta/llama-3.1-8b-instruct-fp8']);
  });

  it('「スレッド一覧と選択した質問・回答を並べて表示します」の説明文は削除されている', () => {
    expect(html).not.toContain('スレッド一覧と選択した質問・回答を並べて表示します');
  });

  it('ナイトモードボタンは画面上部(.intro)ではなく3列スタイルモーダルの中にある', () => {
    const introMatch = html.match(/<section class="intro"[\s\S]*?<\/section>/);
    expect(introMatch).not.toBeNull();
    expect(introMatch![0]).not.toContain('id="nightModeToggle"');

    const modalMatch = html.match(/<div id="threeColumnStyleModal"[\s\S]*?<\/div>\s*<button id="composerTab"/);
    expect(modalMatch).not.toBeNull();
    expect(modalMatch![0]).toContain('id="nightModeToggle"');
    expect(modalMatch![0]).toContain('id="viewToggle"');
  });

  it('CSS選択ボタンが3列スタイルモーダルの中に存在し、専用モーダルを開く', () => {
    const modalMatch = html.match(/<div id="threeColumnStyleModal"[\s\S]*?<\/div>\s*<button id="composerTab"/);
    expect(modalMatch![0]).toContain('id="cssThemeButton"');
    expect(modalMatch![0]).toContain('aria-controls="cssThemeModal"');
    expect(html).toContain('id="cssThemeModal"');
  });

  it('CSS選択モーダルは3列スタイルモーダルより高いz-indexで最上位レイヤーに表示される', () => {
    const styleBackdropZ = html.match(/\.style-sheet-backdrop\{[^}]*z-index:(\d+)/);
    const cssBackdropZ = html.match(/\.css-theme-backdrop\{[^}]*z-index:(\d+)/);
    expect(styleBackdropZ).not.toBeNull();
    expect(cssBackdropZ).not.toBeNull();
    expect(Number(cssBackdropZ![1])).toBeGreaterThan(Number(styleBackdropZ![1]));
  });

  it('適用ボタンを押すまではプレビューのみで、押すとCookieに保存される', () => {
    expect(html).toContain('id="cssThemeApply"');
    expect(html).toContain('CSS_THEME_COOKIE');
    expect(html).toContain("cssThemeApply.addEventListener('click'");
    expect(html).toMatch(/cssThemeApply\.addEventListener\('click',function\(\)\{[^}]*document\.cookie=CSS_THEME_COOKIE/);
  });

  it('モーダルを適用せずに閉じるとプレビューは保存前の状態に戻る', () => {
    expect(html).toContain('function setCssThemeOpen(');
    expect(html).toMatch(/applyCssTheme\(savedCssKey\)/);
  });

  it('dynamicnekoのai-panel(StylePicker enhanced)と同レベルの選択肢数(色テーマ+画面全体フィルター)を持つ', () => {
    expect(html).toContain('CSS_THEME_PRESETS');
    const presetCount = (html.match(/\{kind:'(?:style|fx)',id:'[a-z-]+',label:/g) || []).length;
    expect(presetCount).toBeGreaterThanOrEqual(29);
  });

  it('dynamicnekoのStylePicker(enhanced)にある色テーマ・画面全体フィルターのidが一通り揃っている', () => {
    const expectedStyleIds = ['minimal', 'paper', 'sunset', 'ember', 'candy', 'ocean', 'terminal', 'matrix', 'neon', 'hologram', 'dracula', 'glitch', 'aurora', 'lined'];
    const expectedFxIds = ['glass', 'mono', 'rounded', 'tracking', 'crosshair', 'blueprint', 'neon-text', 'selection', 'grayscale', 'invert', 'blur', 'hue-rotate'];
    expectedStyleIds.forEach((id) => expect(html).toContain(`{kind:'style',id:'${id}'`));
    expectedFxIds.forEach((id) => expect(html).toContain(`{kind:'fx',id:'${id}'`));
    // sepia・crtはstyle/fx両方に存在するため、kind付きで両方を確認する
    expect(html).toContain("{kind:'style',id:'crt'");
    expect(html).toContain("{kind:'fx',id:'crt'");
    expect(html).toContain("{kind:'fx',id:'sepia'");
  });

  it('色テーマ(style)選択と画面全体フィルター(fx)選択は排他的に切り替わる(dynamicnekoと同じ挙動)', () => {
    expect(html).toContain("document.documentElement.setAttribute('data-css-fx',id)");
    expect(html).toContain("document.documentElement.removeAttribute('data-css-style')");
    expect(html).toContain("document.documentElement.setAttribute('data-css-style',id)");
    expect(html).toContain("document.documentElement.removeAttribute('data-css-fx')");
  });

  it('各ボタンは自身のスタイル/フィルターをインラインstyleでプレビュー表示する', () => {
    expect(html).toContain('STYLE_SWATCHES');
    expect(html).toContain('FX_PREVIEWS');
    expect(html).toContain('function presetPreviewStyle(');
    expect(html).toMatch(/data-css-id="'\+preset\.id\+'"\s+style="'\+esc\(presetPreviewStyle\(preset\)\)/);
  });

  it('ボタンの可視テキストは短縮ラベル、aria-label/titleは完全なラベルを使う(「(画面全体)」等が見た目の文字数を圧迫しない)', () => {
    expect(html).toContain('short:');
    expect(html).toMatch(/aria-label="'\+esc\(preset\.label\)/);
    expect(html).toMatch(/esc\(preset\.short\)\+'<\/button>/);
  });

  it('選択肢グリッドはauto-fitで列数が可変になり、狭い場合は4列相当まで詰められる(固定3列ではない)', () => {
    expect(html).toMatch(/\.css-theme-options\{[^}]*grid-template-columns:repeat\(auto-fit,minmax\(\d+px,1fr\)\)/);
  });

  it('CSS選択モーダルはヘッダーをドラッグして自由に移動できる', () => {
    expect(html).toContain('CSS_MODAL_POS_COOKIE');
    expect(html).toContain("cssThemeHead.addEventListener('pointerdown'");
    expect(html).toContain("cssThemeHead.addEventListener('pointermove'");
    expect(html).toContain("cssThemeHead.addEventListener('pointerup'");
    expect(html).toMatch(/document\.cookie=CSS_MODAL_POS_COOKIE/);
  });

  it('モーダルを開いたとき、保存済みの位置があれば復元する', () => {
    expect(html).toContain('function readCssModalPos(');
    expect(html).toContain('function applyCssModalPos(');
    expect(html).toMatch(/applyCssModalPos\(readCssModalPos\(\)\)/);
  });
});
