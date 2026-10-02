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
    expect(html).toMatch(/applyCssTheme\(savedCssTheme\)/);
  });

  it('複数のスタイルシートプリセットを切り替えられる', () => {
    expect(html).toContain('CSS_THEME_PRESETS');
    const presetCount = (html.match(/\{id:'[a-z]+',label:/g) || []).length;
    expect(presetCount).toBeGreaterThanOrEqual(2);
  });
});
