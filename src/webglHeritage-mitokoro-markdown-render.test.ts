import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';

describe('世界遺産ページ 見どころモーダルのMarkdown描画', () => {
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

  it('共通Markdownパーサー(getMarkdownParserScript)のparseMdを埋め込んでいる', () => {
    expect(html).toContain('function parseMd(src)');
  });

  it('モーダル本文にmitokoro-mdクラスを付与しMarkdown用CSSを適用する', () => {
    expect(html).toContain("body.className = 'mitokoro-md';");
    expect(html).toContain('.mitokoro-md h1');
    expect(html).toContain('.mitokoro-md table');
  });

  it('取得した回答があればparseMd経由のrenderMitokoroAnswerWithKeywordHighlightsでHTMLへ描画する', () => {
    expect(html).toContain('function renderMitokoroAnswerWithKeywordHighlights(answerText, keywords, enabled)');
    expect(html).toContain("var html = parseMd(answerText || '');");
    expect(html).toContain('body.innerHTML = renderMitokoroAnswerWithKeywordHighlights(answerText, hitKeywords, highlightEnabled);');
    expect(html).toContain('if (data.answer)');
  });

  it('回答が無い場合はtextContentのままerror/未応答メッセージを表示する（Markdown解釈しない）', () => {
    expect(html).toContain("body.textContent = data.error || '（応答なし）';");
  });

  it('通信エラー時もtextContentのまま表示する', () => {
    expect(html).toContain("body.textContent = '通信エラーが発生しました。';");
  });

  it('埋め込まれたparseMdはinline()内でesc()による生HTMLエスケープを行う（XSS対策）', () => {
    // 実際の評価テストは src/utils/markdownRenderer.test.ts で行っている。
    // ここでは webglHeritage.ts に埋め込まれたスクリプトが同じ安全な実装（生テキストを
    // esc()してからMarkdown記法を適用する版）であることをソース上で確認する。
    expect(html).toContain('function inline(text) {\n      text = esc(text);');
    expect(html).toContain('function isSafeMdUrl(url)');
  });
});
