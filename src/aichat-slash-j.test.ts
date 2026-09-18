import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  formatJevKeywordLookup,
  interpretAichatSlashCommand,
  AICHAT_SEARCH_TIMEOUT_MS,
  type AichatJevKeywordLookupOutcome,
} from './utils/aichatSlashCommand';

// 対象: AIチャットの入力窓 `/neko j <キーワード>` サブコマンド。
// jev_evaluations(dynamicnekoの/ai-cacheページの一括評価ボタンが書き込む、
// share_id/modelで引く通常のJev評価結果)をai_chat_shares.questionの
// キーワード部分一致で絞り込み、該当する評価済みshare件数を返す。
// (jev_country_keyword_evaluationsという別系統のテーブルも存在するが、
// 書き込み経路が無く実データが入らないため、/neko jはこちらを見ない)
//
// 故障シナリオ:
//   (1) キーワード未指定でエラーにならず案内を返す
//   (2) depsにjevKeywordLookupが無い場合に例外になる
//   (3) DB問い合わせが長時間応答しない場合に永久に待ち続けてしまう(ハング)
//   (4) DB問い合わせが例外を投げた場合に、エラーメッセージを返さず
//       握りつぶしてしまう(CLAUDE.mdルール8: 記録・通知の義務)
//   (5) 0件の場合に「未登録」であることが分かる表示にならない

describe('formatJevKeywordLookup', () => {
  it('キーワード未指定は案内を返す', () => {
    expect(formatJevKeywordLookup('', { hitCount: 0 })).toBe('❌ キーワードを指定してください: /neko j <キーワード>');
  });

  it('ヒット件数を表示する', () => {
    expect(formatJevKeywordLookup('フランス', { hitCount: 5 })).toBe('「フランス」のJev評価データ: 5件');
  });

  it('0件のときは未登録であることが分かる表示にする', () => {
    expect(formatJevKeywordLookup('パスタ', { hitCount: 0 })).toBe('「パスタ」のJev評価データ: 0件(未登録)');
  });

  it('罫線・ツリー文字を使わない(CLAUDE.mdルール16)', () => {
    expect(formatJevKeywordLookup('タイ', { hitCount: 3 })).not.toMatch(/[├└│─┼]/);
  });
});

describe('interpretAichatSlashCommand: /neko j', () => {
  const now = new Date('2026-07-15T00:00:00.000Z');

  it('/neko j <キーワード> はdepsのjevKeywordLookupを呼び、ヒット件数を整形して返す', async () => {
    const outcome: AichatJevKeywordLookupOutcome = { hitCount: 5 };
    const lookupFn = vi.fn().mockResolvedValue(outcome);
    const result = await interpretAichatSlashCommand('/neko j フランス', now, {
      fetchLatestCommitAgentLog: async () => null,
      jevKeywordLookup: lookupFn,
    });
    expect(lookupFn).toHaveBeenCalledWith('フランス');
    expect(result).toEqual({ handled: true, response: formatJevKeywordLookup('フランス', outcome) });
  });

  it('キーワード未指定はdepsを呼ばず案内を返す', async () => {
    const lookupFn = vi.fn();
    const result = await interpretAichatSlashCommand('/neko j', now, {
      fetchLatestCommitAgentLog: async () => null,
      jevKeywordLookup: lookupFn,
    });
    expect(lookupFn).not.toHaveBeenCalled();
    expect(result).toEqual({ handled: true, response: formatJevKeywordLookup('', { hitCount: 0 }) });
  });

  it('depsにjevKeywordLookupが無い場合は現在利用できない旨を返す(例外にならない)', async () => {
    const result = await interpretAichatSlashCommand('/neko j フランス', now, {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('❌');
    expect(result.response).toContain('/neko j');
  });

  it('未対応コマンドのヘルプ・/neko helpに /neko j を含める', async () => {
    const deps = { fetchLatestCommitAgentLog: async () => null };
    const unknown = await interpretAichatSlashCommand('/neko unknown', now, deps);
    expect(unknown.handled).toBe(true);
    if (!unknown.handled) throw new Error('not handled');
    expect(unknown.response).toContain('/neko j');

    const help = await interpretAichatSlashCommand('/neko help', now, deps);
    expect(help.handled).toBe(true);
    if (!help.handled) throw new Error('not handled');
    expect(help.response).toContain('/neko j');
    expect(help.response).toContain('Jev');
  });
});

describe('interpretAichatSlashCommand: /neko j のタイムアウト・エラー処理', () => {
  const now = new Date('2026-07-15T00:00:00.000Z');

  afterEach(() => {
    vi.useRealTimers();
  });

  it(`jevKeywordLookupが${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答しない場合はタイムアウトの案内を返す(ハングしない)`, async () => {
    vi.useFakeTimers();
    const neverResolves = new Promise<AichatJevKeywordLookupOutcome>(() => {});
    const lookupFn = vi.fn().mockReturnValue(neverResolves);

    const resultPromise = interpretAichatSlashCommand('/neko j フランス', now, {
      fetchLatestCommitAgentLog: async () => null,
      jevKeywordLookup: lookupFn,
    });
    await vi.advanceTimersByTimeAsync(AICHAT_SEARCH_TIMEOUT_MS);
    const result = await resultPromise;

    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('タイムアウト');
    expect(result.response).toContain('/neko j');
  });

  it('タイムアウト時間より前に応答すれば、通常どおりヒット件数を返す', async () => {
    vi.useFakeTimers();
    const outcome: AichatJevKeywordLookupOutcome = { hitCount: 2 };
    const lookupFn = vi.fn().mockResolvedValue(outcome);

    const resultPromise = interpretAichatSlashCommand('/neko j タイ', now, {
      fetchLatestCommitAgentLog: async () => null,
      jevKeywordLookup: lookupFn,
    });
    await vi.advanceTimersByTimeAsync(10);
    const result = await resultPromise;

    expect(result).toEqual({ handled: true, response: formatJevKeywordLookup('タイ', outcome) });
  });

  it('jevKeywordLookupが例外を投げた場合は握りつぶさずエラーメッセージを返す', async () => {
    const lookupFn = vi.fn().mockRejectedValue(new Error('D1 query failed'));
    const result = await interpretAichatSlashCommand('/neko j フランス', now, {
      fetchLatestCommitAgentLog: async () => null,
      jevKeywordLookup: lookupFn,
    });

    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('エラー');
    expect(result.response).toContain('D1 query failed');
  });
});
