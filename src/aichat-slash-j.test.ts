import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  formatJevKeywordLookup,
  interpretAichatSlashCommand,
  AICHAT_SEARCH_TIMEOUT_MS,
  type AichatJevKeywordLookupOutcome,
} from './utils/aichatSlashCommand';

// 対象: AIチャットの入力窓 `/neko j <キーワード>` サブコマンド。
// jev_evaluations(dynamicnekoの/ai-cacheページの一括評価ボタンが書き込む、
// share_id/modelで引く通常のJev評価結果)をai_chat_shares.question・answerの
// キーワード部分一致で絞り込み、該当する評価済みshare件数と、各share
// (先頭AICHAT_JEV_KEYWORD_SCORE_LIMIT件)のjev_label_id=1〜20(ループA)の
// 個別スコアをMarkdown表で返す。ビジネスロジック(1〜20スコアの解決)は
// index.ts側のjevKeywordLookupが担い、このファイルはdeps注入で検証する。
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
//   (6) 1〜20スコアの表示に罫線・ツリー文字(CLAUDE.mdルール16違反)を使う
//   (7) 値が無いラベルIDを黙って表から除外してしまう(欠落が分からなくなる)

describe('formatJevKeywordLookup', () => {
  it('キーワード未指定は案内を返す', () => {
    expect(formatJevKeywordLookup('', { hitCount: 0, results: [] })).toBe('❌ キーワードを指定してください: /neko j <キーワード>');
  });

  it('0件のときは未登録であることが分かる表示にする', () => {
    expect(formatJevKeywordLookup('パスタ', { hitCount: 0, results: [] })).toBe('「パスタ」のJev評価データ: 0件(未登録)');
  });

  it('ヒットしたshareを1行とし、ラベル1〜20を横方向の列として並べたMarkdown表を表示する', () => {
    const outcome: AichatJevKeywordLookupOutcome = {
      hitCount: 1,
      results: [
        {
          shareId: 's1',
          question: 'フランスの首都は?',
          model: 'gemma-4-26b-a4b-it',
          values: [
            { jevLabelId: 1, value: 0.9 },
            { jevLabelId: 2, value: null },
          ],
        },
      ],
    };
    const response = formatJevKeywordLookup('フランス', outcome);
    expect(response).toContain('「フランス」のJev評価データ: 1件');
    // ラベルID(L1, L2, ...)が横方向の列見出しになる(縦にラベル数だけ行を積まない)
    expect(response).toContain('| 質問ID | 質問文 | モデル | L1 | L2 |');
    // 質問ID1件=1行に、L1のスコアとL2の欠落(-)が横並びで入る
    expect(response).toContain('| s1 | フランスの首都は? | gemma-4-26b-a4b-it | 0.9 | - |');
  });

  it('表示上限(AICHAT_JEV_KEYWORD_SCORE_LIMIT)より多くヒットした場合は残数を案内する', () => {
    const outcome: AichatJevKeywordLookupOutcome = {
      hitCount: 8,
      results: [{ shareId: 's1', question: 'q', model: 'm', values: [{ jevLabelId: 1, value: 0.5 }] }],
    };
    const response = formatJevKeywordLookup('タイ', outcome);
    expect(response).toContain('先頭1件のみ表示。全8件');
  });

  it('罫線・ツリー文字を使わない(CLAUDE.mdルール16)', () => {
    const outcome: AichatJevKeywordLookupOutcome = {
      hitCount: 1,
      results: [{ shareId: 's1', question: 'q', model: 'm', values: [{ jevLabelId: 1, value: 0.5 }] }],
    };
    expect(formatJevKeywordLookup('タイ', outcome)).not.toMatch(/[├└│─┼]/);
  });
});

describe('interpretAichatSlashCommand: /neko j', () => {
  const now = new Date('2026-07-15T00:00:00.000Z');

  it('/neko j <キーワード> はdepsのjevKeywordLookupを呼び、ヒット件数とスコア表を整形して返す', async () => {
    const outcome: AichatJevKeywordLookupOutcome = {
      hitCount: 1,
      results: [{ shareId: 's1', question: 'フランスの首都は?', model: 'gemma', values: [{ jevLabelId: 1, value: 0.9 }] }],
    };
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
    expect(result).toEqual({ handled: true, response: formatJevKeywordLookup('', { hitCount: 0, results: [] }) });
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

  it('タイムアウト時間より前に応答すれば、通常どおりヒット件数・スコア表を返す', async () => {
    vi.useFakeTimers();
    const outcome: AichatJevKeywordLookupOutcome = {
      hitCount: 1,
      results: [{ shareId: 's1', question: 'q', model: 'm', values: [{ jevLabelId: 1, value: 0.5 }] }],
    };
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
