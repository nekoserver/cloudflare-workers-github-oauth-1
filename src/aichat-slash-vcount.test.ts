import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  formatVectorizedAnswerCount,
  interpretAichatSlashCommand,
  AICHAT_SEARCH_TIMEOUT_MS,
  type AichatVectorizedAnswersOutcome,
} from './utils/aichatSlashCommand';

// 対象: AIチャットの入力窓 `/neko vcount` サブコマンド。
// ベクタ化済み(aichat_answer_vectors)の回答文の件数を、行末に
// 「/総回答数　(〇%)」の形で全回答文に占める割合とともに応答バブル内に
// 表示する。一覧はチャット本文には出さず(応答で埋め尽くさないための
// 暫定措置)、resultsForModalとしてUI側に渡し、最上位レイヤーのモーダルへの
// リンクを埋め込めるようにする。
//
// 故障シナリオ:
//   (1) depsが未提供・DB未設定の場合に例外になる
//   (2) 0件の場合に空文字やundefinedを返して握りつぶす
//   (3) 総回答数が0件の場合に0除算(NaN/Infinity)になってしまう
//   (4) 割合の計算・四捨五入が誤っている
//   (5) DB問い合わせが長時間応答しない場合に永久に待ち続けてしまう(ハング)
//   (6) DB問い合わせが例外を投げた場合に、エラーメッセージを返さず
//       握りつぶしてしまう(CLAUDE.mdルール8: 記録・通知の義務)
//   (7) ヒットがあるのにresultsForModalが渡らず、モーダルを開けない
//   (8) 0件なのにresultsForModalに空配列以外の値が渡ってしまう

describe('formatVectorizedAnswerCount', () => {
  it('件数と総回答数に占める割合(四捨五入)を表示する', () => {
    expect(formatVectorizedAnswerCount(7, 20)).toBe('ベクタ化済みの回答文: 7件 / 20件　(35%)');
  });

  it('割合は四捨五入する(33.33...% → 33%)', () => {
    expect(formatVectorizedAnswerCount(1, 3)).toBe('ベクタ化済みの回答文: 1件 / 3件　(33%)');
  });

  it('総回答数が0件の場合は0除算を避け、割合の表示を省略する', () => {
    expect(formatVectorizedAnswerCount(0, 0)).toBe('ベクタ化済みの回答文: 0件');
  });

  it('ベクタ化済みが0件でも総回答数があれば0%と表示する', () => {
    expect(formatVectorizedAnswerCount(0, 10)).toBe('ベクタ化済みの回答文: 0件 / 10件　(0%)');
  });

  it('罫線・ツリー文字を使わない(CLAUDE.mdルール16)', () => {
    expect(formatVectorizedAnswerCount(3, 10)).not.toMatch(/[├└│─┼]/);
  });
});

describe('interpretAichatSlashCommand: /neko vcount', () => {
  const now = new Date('2026-07-15T00:00:00.000Z');

  it('/neko vcount はdepsのvectorizedAnswersを呼び、件数+割合を整形して返し、一覧をresultsForModalに渡す', async () => {
    const outcome: AichatVectorizedAnswersOutcome = {
      count: 12, totalCount: 40,
      results: [{ id: 's1', question: '質問A' }, { id: 's2', question: '質問B' }],
    };
    const countFn = vi.fn().mockResolvedValue(outcome);
    const result = await interpretAichatSlashCommand('/neko vcount', now, {
      fetchLatestCommitAgentLog: async () => null,
      vectorizedAnswers: countFn,
    });
    expect(countFn).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      handled: true,
      response: formatVectorizedAnswerCount(12, 40),
      resultsForModal: outcome.results,
    });
  });

  it('0件の場合はresultsForModalを付与しない(モーダルを開くリンクを出さない)', async () => {
    const countFn = vi.fn().mockResolvedValue({ count: 0, totalCount: 0, results: [] });
    const result = await interpretAichatSlashCommand('/neko vcount', now, {
      fetchLatestCommitAgentLog: async () => null,
      vectorizedAnswers: countFn,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.resultsForModal).toBeUndefined();
  });

  it('depsにvectorizedAnswersが無い場合は0件と表示する(例外にならない)', async () => {
    const result = await interpretAichatSlashCommand('/neko vcount', now, {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result).toEqual({ handled: true, response: formatVectorizedAnswerCount(0, 0) });
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

  it(`vectorizedAnswersが${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答しない場合はタイムアウトの案内を返す(ハングしない)`, async () => {
    vi.useFakeTimers();
    const neverResolves = new Promise<AichatVectorizedAnswersOutcome>(() => {});
    const countFn = vi.fn().mockReturnValue(neverResolves);

    const resultPromise = interpretAichatSlashCommand('/neko vcount', now, {
      fetchLatestCommitAgentLog: async () => null,
      vectorizedAnswers: countFn,
    });
    await vi.advanceTimersByTimeAsync(AICHAT_SEARCH_TIMEOUT_MS);
    const result = await resultPromise;

    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('タイムアウト');
    expect(result.response).toContain('/neko vcount');
  });

  it('タイムアウト時間より前に応答すれば、通常どおり件数+割合を返す', async () => {
    vi.useFakeTimers();
    const outcome: AichatVectorizedAnswersOutcome = { count: 4, totalCount: 8, results: [] };
    const countFn = vi.fn().mockResolvedValue(outcome);

    const resultPromise = interpretAichatSlashCommand('/neko vcount', now, {
      fetchLatestCommitAgentLog: async () => null,
      vectorizedAnswers: countFn,
    });
    await vi.advanceTimersByTimeAsync(10);
    const result = await resultPromise;

    expect(result).toEqual({ handled: true, response: formatVectorizedAnswerCount(4, 8) });
  });

  it('vectorizedAnswersが例外を投げた場合は握りつぶさずエラーメッセージを返す', async () => {
    const countFn = vi.fn().mockRejectedValue(new Error('D1 query failed'));
    const result = await interpretAichatSlashCommand('/neko vcount', now, {
      fetchLatestCommitAgentLog: async () => null,
      vectorizedAnswers: countFn,
    });

    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('エラー');
    expect(result.response).toContain('D1 query failed');
  });
});
