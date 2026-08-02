import { describe, it, expect } from 'vitest';
import { getMarkdownParserScript, getMarkdownPreviewCSS } from './markdownRenderer';

function loadParseMd(): (src: string) => string {
  const script = getMarkdownParserScript();
  const factory = new Function(`${script}\nreturn parseMd;`);
  return factory();
}

describe('getMarkdownParserScript', () => {
  it('スクリプトに構文エラーがない', () => {
    expect(() => new Function(getMarkdownParserScript())).not.toThrow();
  });

  it('見出し(#)をh1〜h6タグに変換する', () => {
    const parseMd = loadParseMd();
    expect(parseMd('# Title')).toContain('<h1>Title</h1>');
    expect(parseMd('### Sub')).toContain('<h3>Sub</h3>');
  });

  it('太字・斜体・取り消し線を変換する', () => {
    const parseMd = loadParseMd();
    expect(parseMd('**bold**')).toContain('<strong>bold</strong>');
    expect(parseMd('*italic*')).toContain('<em>italic</em>');
    expect(parseMd('~~strike~~')).toContain('<del>strike</del>');
  });

  it('箇条書き・番号リストをul/olに変換する', () => {
    const parseMd = loadParseMd();
    expect(parseMd('- a\n- b')).toContain('<ul><li>a</li><li>b</li></ul>');
    expect(parseMd('1. a\n2. b')).toContain('<ol><li>a</li><li>b</li></ol>');
  });

  it('タスクリストをチェックボックスに変換する', () => {
    const parseMd = loadParseMd();
    const html = parseMd('- [x] done\n- [ ] todo');
    expect(html).toContain('checked disabled');
    expect(html).toContain('task-list-item');
  });

  it('テーブルを変換する', () => {
    const parseMd = loadParseMd();
    const html = parseMd('| a | b |\n|---|---|\n| 1 | 2 |');
    expect(html).toContain('<table>');
    expect(html).toContain('<th>a</th>');
    expect(html).toContain('<td>1</td>');
  });

  it('フェンスドコードブロックとインラインコードを変換する', () => {
    const parseMd = loadParseMd();
    expect(parseMd('```js\nconst x = 1;\n```')).toContain('<pre><code class="language-js">const x = 1;</code></pre>');
    expect(parseMd('`code`')).toContain('<code>code</code>');
  });

  it('正当なリンク・画像を変換する', () => {
    const parseMd = loadParseMd();
    expect(parseMd('[link](https://example.com)')).toContain('<a href="https://example.com" target="_blank" rel="noopener">link</a>');
    expect(parseMd('![alt](https://example.com/a.png)')).toContain('<img src="https://example.com/a.png" alt="alt">');
  });

  // 対象: AIチャットページ(aichat.ts)がこのユーティリティへ統合される前、独自に
  // 保持していたLaTeXコマンド記号変換機能(mdInlineのlatexMap)。統合の際に機能を
  // 落とさないよう、inline()のesc()呼び出しの直後に同等のロジックを追加した。
  it('LaTeX記法($\\cmd$)を対応するUnicode記号に変換する', () => {
    const parseMd = loadParseMd();
    expect(parseMd('$\\rightarrow$')).toContain('→');
    expect(parseMd('$\\alpha$ と $\\beta$')).toContain('α');
    expect(parseMd('$\\alpha$ と $\\beta$')).toContain('β');
    expect(parseMd('$\\geq$')).toContain('≥');
  });

  it('latexMapに定義のないコマンドは元の$\\cmd$表記のまま残す', () => {
    const parseMd = loadParseMd();
    expect(parseMd('$\\notacommand$')).toContain('$\\notacommand$');
  });

  // ---- セキュリティ: AI生成テキスト等の非信頼な入力をinnerHTMLで描画する用途を想定 ----

  it('セキュリティ: 生の<script>タグはエスケープされ実行可能なHTMLにならない', () => {
    const parseMd = loadParseMd();
    const html = parseMd('<script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('セキュリティ: onerror等のイベントハンドラ付きタグもエスケープされる', () => {
    const parseMd = loadParseMd();
    const html = parseMd('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img');
  });

  it('セキュリティ: リンクのjavascript:スキームは拒否されhrefとして出力されない', () => {
    const parseMd = loadParseMd();
    const html = parseMd('[click me](javascript:alert(1))');
    expect(html).not.toContain('href="javascript:alert(1)"');
    expect(html).toContain('click me');
  });

  it('セキュリティ: 画像のdata:スキームも拒否される', () => {
    const parseMd = loadParseMd();
    const html = parseMd('![x](data:text/html,<script>alert(1)</script>)');
    expect(html).not.toContain('src="data:text/html');
  });

  it('セキュリティ: 太字内に紛れ込んだHTMLタグもエスケープされたまま強調表示される', () => {
    const parseMd = loadParseMd();
    const html = parseMd('**<b>bold</b> text**');
    expect(html).toContain('<strong>&lt;b&gt;bold&lt;/b&gt; text</strong>');
  });
});

describe('getMarkdownPreviewCSS', () => {
  it('スタイル文字列を返す', () => {
    const css = getMarkdownPreviewCSS();
    expect(css).toContain('.preview-area');
    expect(css.length).toBeGreaterThan(0);
  });
});
