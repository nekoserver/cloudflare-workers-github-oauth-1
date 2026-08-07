import { describe, it, expect } from 'vitest';
import { buildAichatSourceTotals, AICHAT_SOURCE_LABELS } from './aichatSourceStats';

describe('buildAichatSourceTotals', () => {
  it('slack/textbox/apiそれぞれの件数を集計する', () => {
    const totals = buildAichatSourceTotals([
      { source: 'slack', q_count: 3 },
      { source: 'textbox', q_count: 5 },
      { source: 'api', q_count: 2 },
    ]);
    expect(totals).toEqual({ slack: 3, textbox: 5, api: 2 });
  });

  it('同じsourceが複数行に分かれていても合算する', () => {
    const totals = buildAichatSourceTotals([
      { source: 'slack', q_count: 3 },
      { source: 'slack', q_count: 4 },
    ]);
    expect(totals.slack).toBe(7);
  });

  it('sourceがNULLの既存レコードはapi扱いにする(source列追加以前の既存データのため)', () => {
    const totals = buildAichatSourceTotals([
      { source: null, q_count: 10 },
    ]);
    expect(totals.api).toBe(10);
  });

  it('未知のsource文字列もapi扱いにフォールバックする', () => {
    const totals = buildAichatSourceTotals([
      { source: 'unknown-future-source', q_count: 1 },
    ]);
    expect(totals.api).toBe(1);
  });

  it('空配列の場合は全て0を返す', () => {
    expect(buildAichatSourceTotals([])).toEqual({ slack: 0, textbox: 0, api: 0 });
  });

  it('AICHAT_SOURCE_LABELSに3種類の日本語ラベルが定義されている', () => {
    expect(AICHAT_SOURCE_LABELS.slack).toBe('Slack');
    expect(AICHAT_SOURCE_LABELS.textbox).toBe('AIチャット入力窓');
    expect(AICHAT_SOURCE_LABELS.api).toBe('回答伝播ページ');
  });
});
