import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';

describe('世界遺産ツールチップ: 見どころ×gemma-4-26b-a4b-it キャッシュの👀アイコン', () => {
  const html = getWebGLHeritagePage('tester');

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

  it('ページ読み込み時に見どころ×gemmaキャッシュを一括取得する', () => {
    expect(html).toContain("fetch('/api/aichat/check-heritage-mitokoro-gemma-batch'");
    expect(html).toContain('heritageMitokoroGemmaShareId');
  });

  it('キャッシュがある世界遺産のツールチップ名の行末に👀アイコンを表示する', () => {
    expect(html).toMatch(/var gemmaShareId = heritageMitokoroGemmaShareId\[d\.n\];/);
    expect(html).toMatch(/var gemmaIcon = gemmaShareId \? ' <span id="tt-mitokoro-gemma-btn"/);
    expect(html).toMatch(/d\.n \+ cityIcon \+ gemmaIcon \+ llamaIcon/);
  });

  it('👀アイコンをタップすると最上位レイヤーのモーダル(openHeritageMitokoroCacheModal)を開く', () => {
    expect(html).toContain('function openHeritageMitokoroCacheModal(icon, heritageName, shareId)');
    expect(html).toMatch(/openHeritageMitokoroCacheModal\('👀', name, shareId\);/);
  });



  it('👀モーダルはgemma見どころレコード由来キーワードの本文ヒット数を🔑ボタンで表示しトグルできる', () => {
    expect(html).toContain("fetch('/api/aichat/heritage-mitokoro-keyword-hits?heritage='");
    expect(html).toContain("model=' + encodeURIComponent(HERITAGE_MITOKORO_GEMMA_MODEL)");
    expect(html).toContain("keywordToggle.textContent = '🔑(' + data.hitCount + ')';");
    expect(html).toContain('function renderMitokoroAnswerWithKeywordHighlights(answerText, keywords, enabled)');
    expect(html).toContain("span.style.background = 'rgba(255, 245, 157, 0.45)';");
  });

  it('モーダルのタイトルにモデル名の括弧表記は含まれない（撤去済み）', () => {
    expect(html).toContain("titleEl.textContent = icon + ' ' + heritageName + ' — 見どころ';");
    expect(html).not.toContain('見どころ (gemma-4-26b-a4b-it)');
  });

  it('モーダルは getNextZ() で既存UIを含む最上位の z-index を動的に算出する', () => {
    expect(html).toContain('function getNextZ()');
    expect(html).toMatch(/z-index:' \+ getNextZ\(\) \+/);
    expect(html).toContain("document.querySelectorAll('body *')");
    expect(html).toContain('window.getComputedStyle(el).zIndex');
    expect(html).toContain("document.querySelectorAll('div[data-overlay]')");
  });

  it('モーダルは /api/aichat/shares/:id から回答本文を取得してMarkdownとして描画する', () => {
    expect(html).toContain("fetch('/api/aichat/shares/' + encodeURIComponent(shareId))");
    expect(html).toContain('answerText = stripHeritageCountryPrefix(data.answer);');
    expect(html).toContain('renderAnswer();');
  });
});

describe('世界遺産ツールチップ: 見どころ×llama-3.3-70b-instruct-fp8-fast キャッシュの👁️アイコン', () => {
  const html = getWebGLHeritagePage('tester');

  it('ページ読み込み時に見どころ×llamaキャッシュを一括取得する', () => {
    expect(html).toContain("fetch('/api/aichat/check-heritage-mitokoro-llama-batch'");
    expect(html).toContain('heritageMitokoroLlamaShareId');
  });

  it('キャッシュがある世界遺産のツールチップ名の行末に👁️アイコンを表示する', () => {
    expect(html).toMatch(/var llamaShareId = heritageMitokoroLlamaShareId\[d\.n\];/);
    expect(html).toMatch(/var llamaIcon = llamaShareId \? ' <span id="tt-mitokoro-llama-btn"/);
    expect(html).toContain('👁️');
  });

  it('👁️アイコンをタップするとllama用のモーダルを開く', () => {
    expect(html).toMatch(/openHeritageMitokoroCacheModal\('👁️', name, shareId\);/);
  });
});
