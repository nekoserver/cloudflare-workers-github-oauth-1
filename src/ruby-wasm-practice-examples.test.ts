import { describe, expect, it } from 'vitest';
import { getRubyWasmPage, RUBY_REPL_SNIPPETS } from './views/rubyWasm';

describe('/ruby-wasm サンプル選択モーダル', () => {
  it('従来の練習サンプル行をなくし、画面下の全サンプルをモーダルにも表示する', () => {
    const html = getRubyWasmPage('tester');

    expect(html).not.toContain('練習サンプル（選ぶとエディターへ読み込みます）');
    expect(html).not.toContain('<select id="practiceExample">');
    expect(html).toContain('id="sampleModalOverlay"');
    expect(html).toContain('id="openSamplesBtn"');
    expect(html.match(/data-open-sample=/g)).toHaveLength(RUBY_REPL_SNIPPETS.length);
    for (const snippet of RUBY_REPL_SNIPPETS) {
      expect(html).toContain(snippet.title);
      expect(html).toContain(snippet.description);
      expect(html).toContain(snippet.category);
    }
  });

  it('行タップでは最上位の詳細パネルを開き、閉じれば別のサンプルを選べる', () => {
    const html = getRubyWasmPage('tester');

    expect(html).toContain('id="sampleDetailOverlay"');
    expect(html).toContain("document.querySelectorAll('[data-open-sample]')");
    expect(html).toContain('openModal(sampleDetailOverlay)');
    expect(html).toContain("sampleDetailCloseBtn.addEventListener('click'");
    const rowHandler = html.slice(
      html.indexOf("document.querySelectorAll('[data-open-sample]')"),
      html.indexOf("sampleDetailCloseBtn.addEventListener('click'")
    );
    expect(rowHandler).not.toContain('closeModal(sampleModalOverlay)');
  });

  it('詳細パネルの▲ボタンでREPLを初期化してコードを読み込み、両モーダルを閉じる', () => {
    const html = getRubyWasmPage('tester');

    expect(html).toContain('id="sampleLoadBtn"');
    expect(html).toContain('aria-label="REPLにコピーしてサンプル選択を閉じる">▲</button>');
    expect(html).toContain("sampleLoadBtn.addEventListener('click'");
    expect(html).toContain("inputCode.value = ''");
    expect(html).toContain("resultBlock.style.display = 'none'");
    expect(html).toContain("saveBtn.style.display = 'none'");
    expect(html).toContain('inputCode.value = selectedSampleCode');
    expect(html).toContain('closeModal(sampleDetailOverlay)');
    expect(html).toContain('closeModal(sampleModalOverlay)');
    expect(html).toContain('inputCode.focus()');
  });

  it('詳細パネル内から選択したサンプルを実行して結果を表示できる', () => {
    const html = getRubyWasmPage('tester');

    expect(html).toContain('class="sample-detail-code-wrap"><button type="button" class="snippet-run" id="sampleRunBtn" disabled>Run ▶︎</button><pre');
    expect(html).toContain("sampleRunBtn.addEventListener('click'");
    expect(html).toContain('var result = runRubyCode(selectedSampleCode)');
    expect(html).toContain('sampleDetailResult.textContent = result.output');
    expect(html).toContain('id="sampleDetailResultCloseBtn">close</button>');
    expect(html).toContain("sampleDetailResultCloseBtn.addEventListener('click'");
  });

  it('パターンマッチは範囲パターンに一致したpriceを変数にバインドする', () => {
    const patternMatching = RUBY_REPL_SNIPPETS.find((snippet) => snippet.title === 'パターンマッチ');

    expect(patternMatching).toBeDefined();
    expect(patternMatching!.code).toContain('price: (2000.. => price)');
    expect(patternMatching!.code).toContain('#{price}円');
  });

  it('詳細モーダルの操作を指定位置に配置し、下部の閉じるボタンも機能する', () => {
    const html = getRubyWasmPage('tester');

    expect(html).toContain('class="modal-close sample-detail-corner-close" id="sampleDetailCloseBtn"');
    const heading = html.match(/<div class="sample-detail-heading">(.+?)<\/div>/)?.[1] || '';
    expect(heading.indexOf('id="sampleLoadBtn"')).toBeLessThan(heading.indexOf('id="sampleDetailCategory"'));
    expect(html).toContain('id="sampleDetailBottomCloseBtn">閉じる</button>');
    expect(html).toContain("sampleDetailBottomCloseBtn.addEventListener('click'");
  });

  it('各コードブロックのRunボタンを右上に置き、Ruby 4バッジを表示する', () => {
    const html = getRubyWasmPage('tester');

    expect(html).toContain('.snippet-run { position: absolute; top: 8px; right: 8px;');
    expect(html.match(/class="ruby4-badge">Ruby 4<\/span>/g)).toHaveLength(RUBY_REPL_SNIPPETS.length + 1);
    expect(html).toContain('<div class="snippet-code-wrap"><button type="button" class="snippet-run"');
  });

  it('Ruby 4で動く追加サンプルと学習用バッジを豊富に掲載する', () => {
    expect(RUBY_REPL_SNIPPETS.length).toBeGreaterThanOrEqual(35);
    expect(RUBY_REPL_SNIPPETS.filter((snippet) => snippet.category === 'Ruby 4').length).toBeGreaterThanOrEqual(3);
    expect(RUBY_REPL_SNIPPETS.filter((snippet) => snippet.badges?.length).length).toBeGreaterThanOrEqual(20);
    expect(RUBY_REPL_SNIPPETS.some((snippet) => snippet.title === 'Dataで座標計算')).toBe(true);
    expect(RUBY_REPL_SNIPPETS.some((snippet) => snippet.title === '二分探索')).toBe(true);
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
