import { describe, expect, it } from 'vitest';
import { getRubyWasmPage, RUBY_REPL_SNIPPETS } from './views/rubyWasm';

describe('/ruby-wasm サンプル選択モーダル', () => {
  it('従来の練習サンプル行をなくし、画面下の全サンプルをモーダルにも表示する', () => {
    const html = getRubyWasmPage('tester');

    expect(html).not.toContain('練習サンプル（選ぶとエディターへ読み込みます）');
    expect(html).not.toContain('<select id="practiceExample">');
    expect(html).toContain('id="sampleModalOverlay"');
    expect(html).toContain('id="openSamplesBtn"');
    expect(html.match(/data-load-sample=/g)).toHaveLength(RUBY_REPL_SNIPPETS.length);
    for (const snippet of RUBY_REPL_SNIPPETS) {
      expect(html).toContain(snippet.title);
      expect(html).toContain(snippet.description);
      expect(html).toContain(snippet.category);
    }
  });

  it('タップしたサンプルでREPLと以前の実行状態をクリアしてからコードを読み込む', () => {
    const html = getRubyWasmPage('tester');

    expect(html).toContain("document.querySelectorAll('[data-load-sample]')");
    expect(html).toContain("inputCode.value = ''");
    expect(html).toContain("resultBlock.style.display = 'none'");
    expect(html).toContain("saveBtn.style.display = 'none'");
    expect(html).toContain("inputCode.value = JSON.parse(codeNode.textContent || '\"\"')");
    expect(html).toContain('closeModal(sampleModalOverlay)');
    expect(html).toContain('inputCode.focus()');
  });

  it('全サンプルのコードをRubyシンタックスハイライトし、実行用の元コードも保持する', () => {
    const html = getRubyWasmPage('tester');

    expect(html.match(/<code class="ruby-code">/g)).toHaveLength(RUBY_REPL_SNIPPETS.length);
    expect(html).toContain('class="ruby-keyword">do</span>');
    expect(html).toContain('class="ruby-string">');
    expect(html).toContain('class="ruby-number">');
    expect(html.match(/<script type="application\/json" data-snippet-code=/g)).toHaveLength(RUBY_REPL_SNIPPETS.length);
  });

  it('見出しの右に色分けしたカテゴリ別件数と先頭行へのジャンプリンクを表示する', () => {
    const html = getRubyWasmPage('tester');
    const categories = [...new Set(RUBY_REPL_SNIPPETS.map((snippet) => snippet.category))];

    expect(html).toContain('class="sample-category-links"');
    categories.forEach((category, index) => {
      const count = RUBY_REPL_SNIPPETS.filter((snippet) => snippet.category === category).length;
      expect(html).toContain(`href="#sample-category-${index}"`);
      expect(html).toContain(`id="sample-category-${index}"`);
      expect(html).toContain(`<span>${category}</span><strong>${count}</strong>`);
      expect(html).toContain(`[data-category-index="${index}"]`);
    });
  });

  it('CSV集計はWASMに同梱されないcsv gemへ依存せず実行できる', () => {
    const csv = RUBY_REPL_SNIPPETS.find((snippet) => snippet.title === 'CSV 集計');

    expect(csv).toBeDefined();
    expect(csv!.code).not.toContain('require "csv"');
    expect(csv!.code).toContain('source.lines(chomp: true)');
    expect(csv!.code).toContain('header.zip(values).to_h');
  });
});
