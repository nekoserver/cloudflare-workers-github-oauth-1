import { describe, it, expect } from 'vitest';
import { buildAichatSourceTotals, AICHAT_SOURCE_LABELS, countMuseWasmTestRequests } from './aichatSourceStats';

describe('buildAichatSourceTotals', () => {
  it('slack/textbox/api/dynamicnekoそれぞれの件数を集計する', () => {
    const totals = buildAichatSourceTotals([
      { source: 'slack', q_count: 3 },
      { source: 'textbox', q_count: 5 },
      { source: 'api', q_count: 2 },
      { source: 'dynamicneko', q_count: 4 },
    ]);
    expect(totals).toEqual({ slack: 3, textbox: 5, api: 2, dynamicneko: 4 });
  });

  it('dynamicneko由来のリクエストはapiとは別に集計される(既存のapi集計を汚染しない)', () => {
    const totals = buildAichatSourceTotals([
      { source: 'api', q_count: 2 },
      { source: 'dynamicneko', q_count: 7 },
    ]);
    expect(totals.api).toBe(2);
    expect(totals.dynamicneko).toBe(7);
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
    expect(buildAichatSourceTotals([])).toEqual({ slack: 0, textbox: 0, api: 0, dynamicneko: 0 });
  });

  it('AICHAT_SOURCE_LABELSに4種類の日本語ラベルが定義されている', () => {
    expect(AICHAT_SOURCE_LABELS.slack).toBe('Slack');
    expect(AICHAT_SOURCE_LABELS.textbox).toBe('AIチャット入力窓');
    expect(AICHAT_SOURCE_LABELS.api).toBe('回答伝播ページ');
    expect(AICHAT_SOURCE_LABELS.dynamicneko).toBe('ダイナミックワーカー');
  });
});

describe('countMuseWasmTestRequests', () => {
  function fakeDb(result: { n: number } | null | Error) {
    const calls: { sql: string; binds: unknown[] }[] = [];
    const db = {
      prepare(sql: string) {
        return {
          bind(...binds: unknown[]) {
            calls.push({ sql, binds });
            return { first: async () => { if (result instanceof Error) throw result; return result; } };
          },
        };
      },
    } as unknown as D1Database;
    return { db, calls };
  }

  it('INQUIRY_DBのbridge_jobsから、同じユーザー・UTCの同じ月のmuse-wasm-test経由の件数を数える', async () => {
    const { db, calls } = fakeDb({ n: 6 });
    expect(await countMuseWasmTestRequests(db, 'user-1', '2026-11')).toBe(6);
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain('FROM bridge_jobs');
    expect(calls[0].binds).toEqual(['user-1', 'muse-wasm-test', Date.UTC(2026, 10, 1) / 1000, Date.UTC(2026, 11, 1) / 1000]);
  });

  it('12月は翌年1月1日の手前までを数える', async () => {
    const { db, calls } = fakeDb({ n: 0 });
    expect(await countMuseWasmTestRequests(db, 'user-1', '2026-12')).toBe(0);
    expect(calls[0].binds.slice(2)).toEqual([Date.UTC(2026, 11, 1) / 1000, Date.UTC(2027, 0, 1) / 1000]);
  });

  it('INQUIRY_DBが無い・問い合わせに失敗した・月の形が違うときは0ではなくnullを返す(取得できないことを件数0と区別する)', async () => {
    expect(await countMuseWasmTestRequests(undefined, 'user-1', '2026-11')).toBeNull();
    expect(await countMuseWasmTestRequests(fakeDb(new Error('D1_ERROR')).db, 'user-1', '2026-11')).toBeNull();
    expect(await countMuseWasmTestRequests(fakeDb({ n: 1 }).db, 'user-1', 'bad')).toBeNull();
  });
});
