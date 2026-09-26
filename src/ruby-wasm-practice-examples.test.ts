import { describe, expect, it } from 'vitest';
import {
  getRubyWasmPage,
  RUBY_REPL_SNIPPETS,
  RUBY_SAMPLE_AUDIT_RESULTS,
  RUBY_SAMPLE_AUDIT_VERSIONS,
} from './views/rubyWasm';

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
    expect(html).toContain('highlightRubyOutput(sampleDetailResult, result.output)');
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

  it('各コードブロックのRunボタンを右上に置き、互換Rubyバージョンを薄緑のバッジで表示する', () => {
    const html = getRubyWasmPage('tester');

    expect(html).toContain('.snippet-run { position: absolute; top: 8px; right: 8px;');
    expect(html.match(/class="ruby-version-badge">Ruby 3\.4<\/small>/g)).toHaveLength(RUBY_REPL_SNIPPETS.length * 2);
    expect(html.match(/class="ruby-version-badge">Ruby 4<\/small>/g)).toHaveLength(RUBY_REPL_SNIPPETS.length * 2);
    expect(html).toContain('.ruby-version-badge { padding: 2px 6px; border: 1px solid #86efac;');
    expect(html).toContain('.ruby-version-badges { display: flex; flex: none; flex-wrap: wrap; justify-content: flex-end; gap: 4px; margin-left: auto;');
    expect(html).not.toContain('class="ruby4-badge"');
    expect(html).toContain('<div class="snippet-code-wrap"><button type="button" class="snippet-run"');
  });

  it('詳細モーダルにも選択サンプルの互換バージョンバッジを引き継ぐ', () => {
    const html = getRubyWasmPage('tester');

    expect(html).toContain('id="sampleDetailVersions" aria-label="動作確認済みRubyバージョン"');
    expect(html).toContain("sampleDetailVersions.innerHTML = button.querySelector('.ruby-version-badges').innerHTML");
    expect(html).toContain('.ruby-version-badge.ruby4-only { border-color: #93c5fd;');
  });

  it('Ruby 4で動く追加サンプルと学習用バッジを豊富に掲載する', () => {
    expect(RUBY_REPL_SNIPPETS.length).toBeGreaterThanOrEqual(47);
    expect(RUBY_REPL_SNIPPETS.filter((snippet) => snippet.category === 'Ruby 4').length).toBeGreaterThanOrEqual(4);
    expect(RUBY_REPL_SNIPPETS.filter((snippet) => snippet.badges?.length).length).toBeGreaterThanOrEqual(20);
    expect(RUBY_REPL_SNIPPETS.some((snippet) => snippet.title === 'Dataで座標計算')).toBe(true);
    expect(RUBY_REPL_SNIPPETS.some((snippet) => snippet.title === '二分探索')).toBe(true);
  });

  it('カテゴリごとに足りない学習テーマのサンプルを掲載する', () => {
    const additions = [
      ['メソッドと戻り値', '基本'],
      ['partitionで仕分け', 'Enumerable'],
      ['ネストしたHashを集計', 'データ'],
      ['単語のラッピング', '文字列'],
      ['継承とsuper', 'オブジェクト'],
      ['幅優先探索', 'アルゴリズム'],
      ['ドット絵アニメ', '遊ぶ'],
      ['右代入で分解', 'Ruby 4'],
    ] as const;

    additions.forEach(([title, category]) => {
      const snippet = RUBY_REPL_SNIPPETS.find((item) => item.title === title);
      expect(snippet?.category).toBe(category);
      expect(snippet?.description.length).toBeGreaterThan(0);
      expect(snippet?.badges?.length).toBeGreaterThan(0);
      expect(snippet?.code.length).toBeGreaterThan(0);
      expect(RUBY_SAMPLE_AUDIT_RESULTS[title]).toEqual({ ruby34: 'ok', ruby40Wasm: 'ok' });
    });
  });

  it('未掲載だったRubyの主要テーマを追加する', () => {
    const additions = ['ブロックとyield', 'lazyで必要分だけ計算', 'Hashのマージルール', 'Unicode文字の数え上げ', 'Comparableでバージョン比較', '深さ優先探索', '迷路の自動生成', 'パターンのガード条件'];

    expect(RUBY_REPL_SNIPPETS.length).toBeGreaterThanOrEqual(55);
    additions.forEach((title) => {
      const snippet = RUBY_REPL_SNIPPETS.find((item) => item.title === title);
      expect(snippet?.badges?.length).toBeGreaterThan(0);
      expect(snippet?.code.length).toBeGreaterThan(0);
      expect(RUBY_SAMPLE_AUDIT_RESULTS[title]).toEqual({ ruby34: 'ok', ruby40Wasm: 'ok' });
    });
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

  it('トップバナー直下にスクロール追従するカテゴリー別ジャンプバッジを表示する', () => {
    const html = getRubyWasmPage('tester');
    const categories = [...new Set(RUBY_REPL_SNIPPETS.map((snippet) => snippet.category))];

    expect(html).toContain('<nav class="sample-jump-bar" aria-label="サンプルカテゴリーへジャンプ">');
    expect(html).toContain('.sample-jump-bar {\n      position: sticky; top: 0; z-index: 20;');
    expect(html.indexOf('class="sample-jump-bar"')).toBeGreaterThan(html.indexOf('class="navbar"'));
    expect(html.indexOf('class="sample-jump-bar"')).toBeLessThan(html.indexOf('class="container"'));
    categories.forEach((category, index) => {
      const count = RUBY_REPL_SNIPPETS.filter((snippet) => snippet.category === category).length;
      expect(html).toContain(`data-page-category-filter="${index}"`);
      expect(html).toContain(`id="page-sample-category-${index}"`);
      expect(html).toContain(`<span>${category}</span><strong>${count}</strong>`);
    });
  });

  it('トップバナーを薄く右寄せにし、バッジで単一カテゴリーをフィルターする', () => {
    const html = getRubyWasmPage('tester');

    expect(html).toContain('padding: 3px max(10px, calc((100vw - 1120px) / 2 + 20px));');
    expect(html).toContain('justify-content: flex-end; width: max-content; min-width: 100%; gap: 4px;');
    expect(html).toContain('data-category-index="0" data-page-category-filter="0" aria-pressed="false"');
    expect(html).toContain("pageCategoryLinks.classList.toggle('has-filter', willSelect)");
    expect(html).toContain("card.hidden = willSelect && card.getAttribute('data-category-index') !== categoryIndex");
    expect(html).toContain('.sample-jump-links.has-filter .page-category-link:not([aria-pressed="true"])');
  });

  it('CSV集計はWASMに同梱されないcsv gemへ依存せず実行できる', () => {
    const csv = RUBY_REPL_SNIPPETS.find((snippet) => snippet.title === 'CSV 集計');

    expect(csv).toBeDefined();
    expect(csv!.code).not.toContain('require "csv"');
    expect(csv!.code).toContain('source.lines(chomp: true)');
    expect(csv!.code).toContain('header.zip(values).to_h');
  });

  it('全サンプルのRuby 3.4系・Ruby 4.0系での実行結果を表で表示する', () => {
    const html = getRubyWasmPage('tester');

    expect(html).toContain('id="sampleAuditTitle"');
    expect(html).toContain('全サンプルのRubyバージョン別実行結果');
    expect(html).toContain('Ruby 3.4.4');
    expect(html).toContain('Ruby 4.0系');
    expect(html.match(/<tr><th scope="row">/g)).toHaveLength(RUBY_REPL_SNIPPETS.length);
    expect(html.match(/✓ エラーなし/g)).toHaveLength(RUBY_REPL_SNIPPETS.length * RUBY_SAMPLE_AUDIT_VERSIONS.length);
    for (const snippet of RUBY_REPL_SNIPPETS) {
      expect(RUBY_SAMPLE_AUDIT_RESULTS[snippet.title]).toEqual({ ruby34: 'ok', ruby40Wasm: 'ok' });
    }
  });

  it('トップバナーのカテゴリーバッジを固有色で表示し、左端の「選択解除」でフィルターを解除できる', () => {
    const html = getRubyWasmPage('tester');
    const resetIndex = html.indexOf('data-page-category-reset');
    const firstCategoryIndex = html.indexOf('data-page-category-filter="0"');

    expect(resetIndex).toBeGreaterThanOrEqual(0);
    expect(resetIndex).toBeLessThan(firstCategoryIndex);
    expect(html).toContain('class="page-category-link" data-category-index="0"');
    expect(html).toContain('[data-category-index="0"] { --category-color: #e11d48; }');
    expect(html).toContain("pageCategoryReset.addEventListener('click', resetPageCategoryFilter)");
    expect(html).toContain("pageCategoryLinks.classList.remove('has-filter')");
    expect(html).toContain('card.hidden = false');
  });

  it('未掲載だった主要テーマを各カテゴリーへ追加する', () => {
    const additions = [
      ['Procとlambda', '基本'], ['可変長引数と展開', '基本'],
      ['each_with_objectで索引', 'Enumerable'], ['slice_whenで連続区間', 'Enumerable'],
      ['行列データの転置', 'データ'], ['JSONイベント変換', 'データ'],
      ['名前付きキャプチャ', '文字列'], ['文字列のエスケープ', '文字列'],
      ['委譲でプレイリスト', 'オブジェクト'], ['メソッドの可視性', 'オブジェクト'],
      ['マージソート', 'アルゴリズム'], ['動的計画法で両替', 'アルゴリズム'],
      ['じゃんけん大会', '遊ぶ'], ['数当てヒント', '遊ぶ'],
      ['配列パターンの残余', 'Ruby 4'], ['ハッシュパターンの別名', 'Ruby 4'],
    ] as const;

    expect(RUBY_REPL_SNIPPETS.length).toBeGreaterThanOrEqual(71);
    additions.forEach(([title, category]) => {
      const snippet = RUBY_REPL_SNIPPETS.find((item) => item.title === title);
      expect(snippet?.category).toBe(category);
      expect(snippet?.badges?.length).toBeGreaterThan(0);
      expect(snippet?.code.length).toBeGreaterThan(0);
      expect(RUBY_SAMPLE_AUDIT_RESULTS[title]).toEqual({ ruby34: 'ok', ruby40Wasm: 'ok' });
    });
  });

  it('実行結果もRubyトークンとして安全にシンタックスハイライトする', () => {
    const html = getRubyWasmPage('tester');

    expect(html).toContain('function highlightRubyOutput(target, source)');
    expect(html).toContain("target.innerHTML = highlightRubyText(source)");
    expect(html).toContain('highlightRubyOutput(resultValue, result.output)');
    expect(html).toContain('highlightRubyOutput(output, result.output)');
    expect(html).toContain('highlightRubyOutput(sampleDetailResult, result.output)');
    expect(html).toContain('highlightRubyOutput(modalResultValue, result.output)');
  });

  it('トップパネル左上のメソッド一覧を由来別に表示し、閉じるとフィルターを解除する', () => {
    const html = getRubyWasmPage('tester');

    expect(html).toContain('id="methodFilterDetails"');
    expect(html).toContain('class="method-filter-groups"');
    expect(html).toContain('Enumerable');
    expect(html).toContain('その他');
    expect(html).toMatch(/data-method-filter="[^"]+" data-method-snippets="[0-9,]+"/);
    expect(html).toMatch(/class="method-count">[0-9]+<\/span>/);
    expect(html).toContain("methodFilterDetails.addEventListener('toggle'");
    expect(html).toContain('if (!methodFilterDetails.open) resetMethodFilter()');
    expect(html).toContain("card.hidden = allowed.indexOf(card.getAttribute('data-snippet-card')) === -1");
  });

  it('sqlx-d1とその他の実行可能サンプルをさらに幅広く掲載する', () => {
    const sqlxTitles = ['sqlx-d1トランザクション結果', 'sqlx-d1バッチ書き込み', 'sqlx-d1楽観的ロック', 'sqlx-d1検索条件', 'sqlx-d1日付別集計', 'sqlx-d1リレーション結合'];
    const generalTitles = ['Setで重複検出', 'キューでジョブ処理', '状態遷移マシン', '二次元配列の回転', 'ランレングス圧縮', 'LRU風キャッシュ'];

    expect(RUBY_REPL_SNIPPETS.length).toBeGreaterThanOrEqual(83);
    sqlxTitles.forEach((title) => {
      const snippet = RUBY_REPL_SNIPPETS.find((item) => item.title === title);
      expect(snippet?.badges).toContain('sqlx-d1');
    });
    generalTitles.forEach((title) => expect(RUBY_REPL_SNIPPETS.some((item) => item.title === title)).toBe(true));
  });

});
