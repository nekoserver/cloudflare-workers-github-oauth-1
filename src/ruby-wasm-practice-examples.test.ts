import { describe, expect, it } from 'vitest';
import { getRubyWasmPage } from './views/rubyWasm';

describe('/ruby-wasm 練習サンプル', () => {
  it('小規模で実用的な3種類のRubyサンプルを選べる', () => {
    const html = getRubyWasmPage('tester');

    expect(html).toContain('<select id="practiceExample">');
    expect(html).toContain('単語の出現回数を数える');
    expect(html).toContain('JSONを読みやすく整形する');
    expect(html).toContain('支出をカテゴリ別に集計する');
    expect(html).toContain("words.tally.sort_by");
    expect(html).toContain('JSON.pretty_generate(data)');
    expect(html).toContain("expenses.group_by");
  });

  it('選択したサンプルをエディターへ読み込み、以前の実行状態を消す', () => {
    const html = getRubyWasmPage('tester');

    expect(html).toContain("practiceExample.addEventListener('change'");
    expect(html).toContain('inputCode.value = example.code');
    expect(html).toContain("resultBlock.style.display = 'none'");
    expect(html).toContain("saveBtn.style.display = 'none'");
    expect(html).toContain('practiceHint.textContent = example.hint');
  });
});
