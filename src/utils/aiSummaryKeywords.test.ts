import { describe, it, expect, vi } from 'vitest';
import { extractSummaryKeywords, saveSummaryKeywords } from './aiSummaryKeywords';

describe('extractSummaryKeywords', () => {
  it('AI未設定の場合は空配列を返し、抽出関数を呼ばない', async () => {
    const extractTerms = vi.fn();
    const filterTerms = vi.fn();
    const result = await extractSummaryKeywords(null, '要約本文', extractTerms, filterTerms);
    expect(result).toEqual([]);
    expect(extractTerms).not.toHaveBeenCalled();
  });

  it('要約本文が空文字の場合は空配列を返す', async () => {
    const ai = { run: vi.fn() };
    const extractTerms = vi.fn();
    const result = await extractSummaryKeywords(ai, '', extractTerms, vi.fn());
    expect(result).toEqual([]);
    expect(extractTerms).not.toHaveBeenCalled();
  });

  it('抽出・フィルタ結果を返す', async () => {
    const ai = { run: vi.fn() };
    const extractTerms = vi.fn().mockResolvedValue(['keyword1', 'keyword2', 'ignored']);
    const filterTerms = vi.fn((terms: string[]) => terms.filter((t) => t !== 'ignored'));
    const result = await extractSummaryKeywords(ai, '要約本文', extractTerms, filterTerms);
    expect(result).toEqual(['keyword1', 'keyword2']);
    expect(extractTerms).toHaveBeenCalledWith(ai, '要約本文');
  });

  it('抽出に失敗した場合は空配列を返し、onErrorへ伝える(握りつぶさない)', async () => {
    const ai = { run: vi.fn() };
    const error = new Error('AI呼び出し失敗');
    const extractTerms = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();
    const result = await extractSummaryKeywords(ai, '要約本文', extractTerms, vi.fn(), onError);
    expect(result).toEqual([]);
    expect(onError).toHaveBeenCalledWith(error);
  });
});

describe('saveSummaryKeywords', () => {
  it('keywordsが空ならdb.batchを呼ばない', async () => {
    const db = { batch: vi.fn(), prepare: vi.fn() } as unknown as D1Database;
    await saveSummaryKeywords(db, 'req-1', [], '2026-10-10T00:00:00.000Z');
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('keyword毎にINSERT OR IGNORE文をbatchで実行し、request_id経由でsummary_log_idを引く', async () => {
    const bind = vi.fn().mockReturnValue('bound-stmt');
    const prepare = vi.fn().mockReturnValue({ bind });
    const batch = vi.fn().mockResolvedValue([]);
    const db = { batch, prepare } as unknown as D1Database;
    await saveSummaryKeywords(db, 'req-1', ['keyword1', 'keyword2'], '2026-10-10T00:00:00.000Z');
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(prepare.mock.calls[0][0]).toContain('INSERT OR IGNORE INTO ai_summary_keywords');
    expect(prepare.mock.calls[0][0]).toContain('SELECT id, ?, ? FROM ai_summary_log WHERE request_id = ?');
    expect(bind).toHaveBeenNthCalledWith(1, 'keyword1', '2026-10-10T00:00:00.000Z', 'req-1');
    expect(bind).toHaveBeenNthCalledWith(2, 'keyword2', '2026-10-10T00:00:00.000Z', 'req-1');
    expect(batch).toHaveBeenCalledWith(['bound-stmt', 'bound-stmt']);
  });
});
