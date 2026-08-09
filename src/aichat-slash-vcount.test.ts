import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  formatVectorizedAnswerCount,
  interpretAichatSlashCommand,
  AICHAT_SEARCH_TIMEOUT_MS,
} from './utils/aichatSlashCommand';

// 対象: AIチャットの入力窓 `/neko vcount` サブコマンド。
// ベクタ化済み(aichat_answer_vectors)の回答文の件数を応答バブル内に表示する。
//
// 故障シナリオ:
//   (1) depsが未提供・DB未設定の場合に例外になる
//   (2) 0件の場合に空文字やundefinedを返して握りつぶす
//   (3) DB問い合わせが長時間応答しない場合に永久に待ち続けてしまう(ハング)
//   (4) DB問い合わせが例外を投げた場合に、エラーメッセージを返さず
//       握りつぶしてしまう(CLAUDE.mdルール8: 記録・通知の義務)

describe('formatVectorizedAnswerCount', () => {
  it('件数をそのまま表示する', () => {
    expect(formatVectorizedAnswerCount(7)).toBe('ベクタ化済みの回答文: 7件');
  });

  it('0件の場合も0件と表示する(握りつぶさない)', () => {
    expect(formatVectorizedAnswerCount(0)).toBe('ベクタ化済みの回答文: 0件');
  });

  it('罫線・ツリー文字を使わない(CLAUDE.mdルール16)', () => {
    expect(formatVectorizedAnswerCount(3)).not.toMatch(/[├└│─┼]/);
  });
});

describe('interpretAichatSlashCommand: /neko vcount', () => {
  const now = new Date('2026-07-15T00:00:00.000Z');

  it('/neko vcount はdepsのcountVectorizedAnswersを呼び、件数を整形して返す', async () => {
    const countFn = vi.fn().mockResolvedValue(12);
    const result = await interpretAichatSlashCommand('/neko vcount', now, {
      fetchLatestCommitAgentLog: async () => null,
      countVectorizedAnswers: countFn,
    });
    expect(countFn).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ handled: true, response: formatVectorizedAnswerCount(12) });
  });

  it('depsにcountVectorizedAnswersが無い場合は0件と表示する(例外にならない)', async () => {
    const result = await interpretAichatSlashCommand('/neko vcount', now, {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result).toEqual({ handled: true, response: formatVectorizedAnswerCount(0) });
  });

  it('未対応コマンドのヘルプ・/neko helpに /neko vcount を含める', async () => {
    const deps = { fetchLatestCommitAgentLog: async () => null };
    const unknown = await interpretAichatSlashCommand('/neko unknown', now, deps);
    expect(unknown.handled).toBe(true);
    if (!unknown.handled) throw new Error('not handled');
    expect(unknown.response).toContain('/neko vcount');

    const help = await interpretAichatSlashCommand('/neko help', now, deps);
    expect(help.handled).toBe(true);
    if (!help.handled) throw new Error('not handled');
    expect(help.response).toContain('/neko vcount');
    expect(help.response).toContain('ベクタ化済み');
  });
});

describe('interpretAichatSlashCommand: /neko vcount のタイムアウト・エラー処理', () => {
  const now = new Date('2026-07-15T00:00:00.000Z');

  afterEach(() => {
    vi.useRealTimers();
  });

  it(`countVectorizedAnswersが${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答しない場合はタイムアウトの案内を返す(ハングしない)`, async () => {
    vi.useFakeTimers();
    const neverResolves = new Promise<number>(() => {});
    const countFn = vi.fn().mockReturnValue(neverResolves);

    const resultPromise = interpretAichatSlashCommand('/neko vcount', now, {
      fetchLatestCommitAgentLog: async () => null,
      countVectorizedAnswers: countFn,
    });
    await vi.advanceTimersByTimeAsync(AICHAT_SEARCH_TIMEOUT_MS);
    const result = await resultPromise;

    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('タイムアウト');
    expect(result.response).toContain('/neko vcount');
  });

  it('タイムアウト時間より前に応答すれば、通常どおり件数を返す', async () => {
    vi.useFakeTimers();
    const countFn = vi.fn().mockResolvedValue(4);

    const resultPromise = interpretAichatSlashCommand('/neko vcount', now, {
      fetchLatestCommitAgentLog: async () => null,
      countVectorizedAnswers: countFn,
    });
    await vi.advanceTimersByTimeAsync(10);
    const result = await resultPromise;

    expect(result).toEqual({ handled: true, response: formatVectorizedAnswerCount(4) });
  });

  it('countVectorizedAnswersが例外を投げた場合は握りつぶさずエラーメッセージを返す', async () => {
    const countFn = vi.fn().mockRejectedValue(new Error('D1 query failed'));
    const result = await interpretAichatSlashCommand('/neko vcount', now, {
      fetchLatestCommitAgentLog: async () => null,
      countVectorizedAnswers: countFn,
    });

    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('エラー');
    expect(result.response).toContain('D1 query failed');
  });
});
