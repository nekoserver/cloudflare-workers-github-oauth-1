import { describe, expect, it } from 'vitest';
import { getRubyWasmPage, RUBY_REPL_SNIPPETS } from './views/rubyWasm';

describe('/ruby-wasm REPLスニペット集', () => {
  it('幅広いカテゴリの実行可能なスニペットを十分な数掲載する', () => {
    expect(RUBY_REPL_SNIPPETS.length).toBeGreaterThanOrEqual(18);
    expect(new Set(RUBY_REPL_SNIPPETS.map((snippet) => snippet.category))).toEqual(
      new Set(['基本', 'Enumerable', 'データ', '文字列', 'オブジェクト', 'アルゴリズム', '遊ぶ', 'Ruby 4'])
    );

    const html = getRubyWasmPage('tester');
    expect(html.match(/data-snippet-card=/g)).toHaveLength(RUBY_REPL_SNIPPETS.length);
    expect(html.match(/data-run-snippet=/g)).toHaveLength(RUBY_REPL_SNIPPETS.length);
    expect(html).toContain('そのまま動く Ruby スニペット集');
    expect(html).toContain('Run ▶︎');
  });

  it('コードをHTMLエスケープし、JSONペイロードから共通Ruby VMで実行する', () => {
    const html = getRubyWasmPage('tester');

    expect(html).toContain('&lt;&lt;~LOG');
    expect(html).not.toContain('<code>log = <<~LOG');
    expect(html).toContain('type="application/json" data-snippet-code="0"');
    expect(html).toContain("var code = JSON.parse(codeNode.textContent || '\"\"')");
    expect(html).toContain('var result = runRubyCode(code)');
    expect(html).toContain("output.classList.toggle('error', !result.ok)");
  });

  it('WASM準備完了までは全Runボタンを無効化し、完了後に案内文を消してまとめて有効化する', () => {
    const html = getRubyWasmPage('tester');

    expect(html).toContain('class="snippet-run" data-run-snippet="0" disabled');
    expect(html).toContain("document.querySelectorAll('[data-run-snippet]').forEach");
    expect(html).toContain("state.textContent = ''");
    expect(html).not.toContain("state.textContent = '実行できます'");
  });

  it('Runボタンをコードブロック右上に配置し、closeリンクの下線を表示しない', () => {
    const html = getRubyWasmPage('tester');

    expect(html).toContain('<div class="snippet-code-wrap"><button type="button" class="snippet-run"');
    expect(html).toContain('</pre></div>\n      <div class="snippet-actions">');
    expect(html).toContain('.snippet-card pre { max-height: 260px; margin: 0; padding: 14px;');
    expect(html).toContain('.snippet-run { position: absolute; top: 8px; right: 8px;');
    expect(html).toContain('.snippet-output-close { display: block;');
    expect(html).toContain('text-decoration: none;');
    expect(html).not.toContain('text-decoration: underline;');
  });

  it('素数ジェネレーターはWASMに含まれないprime標準ライブラリに依存しない', () => {
    const snippet = RUBY_REPL_SNIPPETS.find((item) => item.title === '素数ジェネレーター');

    expect(snippet).toBeDefined();
    expect(snippet?.code).not.toContain('require "prime"');
    expect(snippet?.code).toContain('Enumerator.new');
    expect(snippet?.code).toContain('Math.sqrt(candidate)');
  });

  it('Base64サンプルはWASMに含まれないbase64標準ライブラリに依存しない', () => {
    const snippet = RUBY_REPL_SNIPPETS.find((item) => item.title === 'Base64エンコード');

    expect(snippet).toBeDefined();
    expect(snippet?.code).not.toContain('require "base64"');
    expect(snippet?.code).toContain('[message].pack("m0")');
    expect(snippet?.code).toContain('encoded.unpack1("m0").force_encoding("UTF-8")');
  });

  it('Run後にcloseボタンを表示し、実行結果を折り畳める', () => {
    const html = getRubyWasmPage('tester');

    expect(html).toContain('data-close-snippet="0"');
    expect(html).toContain('aria-label="実行結果を折り畳む">close</button>');
    expect(html).toContain('resultPanel.hidden = false');
    expect(html).toContain('if (resultPanel) resultPanel.hidden = true');
    expect(html).toContain("resultCloseBtn.addEventListener('click'");
  });
});
