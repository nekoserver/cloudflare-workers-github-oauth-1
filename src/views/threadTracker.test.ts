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

  it('「▦ 3列スタイル」ボタン(threeColumnStyleButton)は撤去されている', () => {
    expect(html).not.toContain('id="threeColumnStyleButton"');
    expect(html).not.toContain('▦ 3列スタイル');
  });

  it('3列スタイルモーダルは左の垂直タブ(threeColumnStyleTab)から開く', () => {
    expect(html).toContain('id="threeColumnStyleTab"');
    expect(html).toContain("styleTab.addEventListener('click'");
  });

  it('ナイトモードボタンは3列スタイルモーダルの中にある', () => {
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

  it('2ペインモード時、検索窓(searchPanel)は画面左の垂直タブ(searchPanelTab)でトグル開閉できる', () => {
    expect(html).toContain('id="searchPanelTab"');
    expect(html).toContain('aria-controls="searchPanel"');
    expect(html).toContain('id="searchPanel"');
    expect(html).toContain("searchPanelTab.addEventListener('click'");
    expect(html).toMatch(/function setSearchPanelOpen\(open\)\{searchPanelEl\.hidden=!open/);
  });

  it('検索窓タブは2ペインモードの時だけ表示される(通常モードでは固定navbarなので不要)', () => {
    expect(html).toMatch(/\.search-panel-tab\{[^}]*display:none/);
    expect(html).toMatch(/\.two-pane-mode \.search-panel-tab\{display:block\}/);
  });

  it('2ペイン状態が解除されている通常モードでは、検索窓はスクロールの影響を受けない固定navbarになる', () => {
    const baseRuleMatch = html.match(/(?<!\.two-pane-mode )\.search-panel\{[^}]*\}/);
    expect(baseRuleMatch).not.toBeNull();
    expect(baseRuleMatch![0]).toContain('position:fixed');
    expect(baseRuleMatch![0]).toContain('top:0');
  });

  it('2ペインモードでは検索窓の固定navbar配置が解除され、通常のグリッド内配置に戻る', () => {
    expect(html).toMatch(/\.two-pane-mode \.search-panel\{position:static/);
  });

  it('ビューモードが切り替わるたびに検索窓は表示状態にリセットされる(閉じたまま固定navbarに取り残されない)', () => {
    expect(html).toMatch(/function applyViewMode\(\)\{[^}]*setSearchPanelOpen\(true\)/);
  });
});
