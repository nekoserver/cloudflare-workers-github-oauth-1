import { describe, expect, it } from 'vitest';
import { getRubyWasmPage, RUBY_REPL_SNIPPETS } from './views/rubyWasm';

describe('/ruby-wasm REPLスニペット集', () => {
  it('幅広いカテゴリの実行可能なスニペットを十分な数掲載する', () => {
    expect(RUBY_REPL_SNIPPETS.length).toBeGreaterThanOrEqual(18);
    expect(new Set(RUBY_REPL_SNIPPETS.map((snippet) => snippet.category))).toEqual(
      new Set(['基本', 'Enumerable', 'データ', '文字列', 'オブジェクト', 'アルゴリズム', '遊ぶ'])
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

  it('WASM準備完了までは全Runボタンを無効化し、完了後にまとめて有効化する', () => {
    const html = getRubyWasmPage('tester');

    expect(html).toContain('class="snippet-run" data-run-snippet="0" disabled');
    expect(html).toContain("document.querySelectorAll('[data-run-snippet]').forEach");
    expect(html).toContain("state.textContent = '実行できます'");
  });
});
