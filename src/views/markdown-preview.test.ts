import { describe, it, expect } from 'vitest';
import { getMarkdownPreviewPage } from './markdown-preview';

describe('getMarkdownPreviewPage', () => {
  const html = getMarkdownPreviewPage();

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

  it('共通markdownパーサー(getMarkdownParserScript)のparseMdを埋め込んでいる', () => {
    expect(html).toContain('function parseMd(src)');
  });

  it('共通CSS(getMarkdownPreviewCSS)を埋め込んでいる', () => {
    expect(html).toContain('.preview-area h1');
    expect(html).toContain('.preview-area table');
  });

  it('プレビューエリア・エディタ・タブ切り替えボタンを含む', () => {
    expect(html).toContain('id="previewArea"');
    expect(html).toContain('id="editor"');
    expect(html).toContain("switchTab('preview')");
  });
});
