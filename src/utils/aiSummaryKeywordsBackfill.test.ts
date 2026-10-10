import { describe, it, expect, vi } from 'vitest';
import { findSummaryKeywordBackfillTargets, runSummaryKeywordBackfill } from './aiSummaryKeywordsBackfill';

describe('findSummaryKeywordBackfillTargets', () => {
  it('summaryがありキーワードが無い行だけをid昇順・limit件で返す', async () => {
    const all = vi.fn().mockResolvedValue({
      results: [
        { id: 1, request_id: 'r1', summary: '- 概要\nA' },
        { id: 2, request_id: 'r2', summary: '- 概要\nB' },
      ],
    });
    const bind = vi.fn().mockReturnValue({ all });
    const db = { prepare: vi.fn().mockReturnValue({ bind }) } as unknown as D1Database;
    const result = await findSummaryKeywordBackfillTargets(db, 20);
    expect(result).toEqual([
      { id: 1, requestId: 'r1', summary: '- 概要\nA' },
      { id: 2, requestId: 'r2', summary: '- 概要\nB' },
    ]);
    expect(bind).toHaveBeenCalledWith(20);
  });

  it('resultsがundefinedでも空配列を返す(例外にしない)', async () => {
    const db = { prepare: vi.fn().mockReturnValue({ bind: vi.fn().mockReturnValue({ all: vi.fn().mockResolvedValue({}) }) }) } as unknown as D1Database;
    expect(await findSummaryKeywordBackfillTargets(db, 20)).toEqual([]);
  });

  it('repoName・event_date範囲を指定するとWHERE句とbind引数に反映される(ディレクトリ単位ではなくリポジトリ・期間単位で絞り込める)', async () => {
    const all = vi.fn().mockResolvedValue({ results: [] });
    const bind = vi.fn().mockReturnValue({ all });
    let capturedSql = '';
    const db = {
      prepare: vi.fn((sql: string) => {
        capturedSql = sql;
        return { bind };
      }),
    } as unknown as D1Database;
    await findSummaryKeywordBackfillTargets(db, 10, {
      repoName: 'nekoserver/rails-root',
      eventDateFrom: '2026-09-01',
      eventDateTo: '2026-09-30',
    });
    expect(capturedSql).toContain('l.repo_full_name = ?');
    expect(capturedSql).toContain('l.event_date >= ?');
    expect(capturedSql).toContain('l.event_date <= ?');
    expect(bind).toHaveBeenCalledWith('nekoserver/rails-root', '2026-09-01', '2026-09-30', 10);
  });

  it('フィルタ未指定なら絞り込み条件無しでlimitだけbindする(従来通り全件対象)', async () => {
    const all = vi.fn().mockResolvedValue({ results: [] });
    const bind = vi.fn().mockReturnValue({ all });
    let capturedSql = '';
    const db = {
      prepare: vi.fn((sql: string) => {
        capturedSql = sql;
        return { bind };
      }),
    } as unknown as D1Database;
    await findSummaryKeywordBackfillTargets(db, 10);
    expect(capturedSql).not.toContain('repo_full_name');
    expect(capturedSql).not.toContain('event_date');
    expect(bind).toHaveBeenCalledWith(10);
  });
});

describe('runSummaryKeywordBackfill', () => {
  it('対象行ごとに抽出・保存し、成功件数と処理件数を返す', async () => {
    const targets = [
      { id: 1, requestId: 'r1', summary: 'A' },
      { id: 2, requestId: 'r2', summary: 'B' },
    ];
    const extractKeywords = vi.fn(async (summary: string) => [`kw-${summary}`]);
    const saveKeywords = vi.fn(async () => {});
    const result = await runSummaryKeywordBackfill(targets, extractKeywords, saveKeywords);
    expect(result).toEqual({ processed: 2, succeeded: 2, failed: [] });
    expect(extractKeywords).toHaveBeenCalledWith('A');
    expect(extractKeywords).toHaveBeenCalledWith('B');
    expect(saveKeywords).toHaveBeenCalledWith('r1', ['kw-A']);
    expect(saveKeywords).toHaveBeenCalledWith('r2', ['kw-B']);
  });

  it('1件の失敗は他の行の処理を止めず、failedに記録する(握りつぶさない)', async () => {
    const targets = [
      { id: 1, requestId: 'r1', summary: 'A' },
      { id: 2, requestId: 'r2', summary: 'B' },
    ];
    const extractKeywords = vi.fn(async (summary: string) => {
      if (summary === 'A') throw new Error('AI呼び出し失敗');
      return ['kw-B'];
    });
    const saveKeywords = vi.fn(async () => {});
    const result = await runSummaryKeywordBackfill(targets, extractKeywords, saveKeywords);
    expect(result.processed).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toEqual([{ id: 1, requestId: 'r1', error: 'AI呼び出し失敗' }]);
    expect(saveKeywords).toHaveBeenCalledWith('r2', ['kw-B']);
    expect(saveKeywords).not.toHaveBeenCalledWith('r1', expect.anything());
  });

  it('対象が0件でも例外にならず処理件数0を返す', async () => {
    const result = await runSummaryKeywordBackfill([], vi.fn(), vi.fn());
    expect(result).toEqual({ processed: 0, succeeded: 0, failed: [] });
  });
});
