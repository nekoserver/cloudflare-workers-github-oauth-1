import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  formatAichatSearchResults,
  interpretAichatSlashCommand,
  AICHAT_SEARCH_TIMEOUT_MS,
  type AichatSearchOutcome,
} from './utils/aichatSlashCommand';

// 対象: AIチャットの入力窓 `/neko search <キーワード>` サブコマンド。
// 質問文・回答文にキーワードを含む過去ログ(searchAiChatShares相当)の
// ヒット件数と、その中から最新5件の質問文のみ(回答文は含めない)を
// 応答バブル内に表示する。
//
// 故障シナリオ:
//   (1) キーワード未指定の場合に例外になる、またはAI呼び出しへ委ねられてしまう
//   (2) ヒット0件の場合に空文字やundefinedを返して握りつぶす
//   (3) 最新5件の質問文が渡された順序(呼び出し側で日時の新しい順)と異なる
//       順序で表示されてしまう
//   (4) 回答文まで表示してしまう(質問文のみのはずが仕様に反する)

describe('formatAichatSearchResults', () => {
  it('ヒット件数と最新5件の質問文を表示する', () => {
    const outcome: AichatSearchOutcome = { hitCount: 8, latestQuestions: ['質問A', '質問B', '質問C'] };
    const text = formatAichatSearchResults('駅', outcome);
    expect(text).toContain('「駅」を質問文・回答文に含む過去ログ: 8件');
    expect(text).toContain('- 質問A');
    expect(text).toContain('- 質問B');
    expect(text).toContain('- 質問C');
  });

  it('渡された質問文の順序(呼び出し側で日時の新しい順)をそのまま保つ', () => {
    const outcome: AichatSearchOutcome = { hitCount: 2, latestQuestions: ['新しい質問', '古い質問'] };
    const text = formatAichatSearchResults('駅', outcome);
    expect(text.indexOf('新しい質問')).toBeLessThan(text.indexOf('古い質問'));
  });

  it('ヒット0件の場合は質問文一覧を表示しない(件数のみ)', () => {
    const text = formatAichatSearchResults('見つからないキーワード', { hitCount: 0, latestQuestions: [] });
    expect(text).toContain('見つからないキーワード');
    expect(text).toContain('0件');
    expect(text).not.toContain('最新5件の質問');
  });

  it('キーワード未指定の場合は使い方を案内する', () => {
    const text = formatAichatSearchResults('', { hitCount: 0, latestQuestions: [] });
    expect(text).toContain('/neko search');
  });

  it('罫線・ツリー文字を使わない(CLAUDE.mdルール16)', () => {
    const outcome: AichatSearchOutcome = { hitCount: 2, latestQuestions: ['質問A'] };
    expect(formatAichatSearchResults('駅', outcome)).not.toMatch(/[├└│─┼]/);
  });
});

describe('interpretAichatSlashCommand: /neko search', () => {
  const now = new Date('2026-07-15T00:00:00.000Z');

  it('/neko search <キーワード> はdepsのsearchSharesへキーワードを渡し、結果を整形して返す', async () => {
    const outcome: AichatSearchOutcome = { hitCount: 5, latestQuestions: ['質問A', '質問B'] };
    const searchFn = vi.fn().mockResolvedValue(outcome);
    const result = await interpretAichatSlashCommand('/neko search 駅', now, {
      fetchLatestCommitAgentLog: async () => null,
      searchShares: searchFn,
    });
    expect(searchFn).toHaveBeenCalledWith('駅');
    expect(result).toEqual({ handled: true, response: formatAichatSearchResults('駅', outcome) });
  });

  it('キーワードに空白を含む場合は"search"以降をすべて連結してキーワードとして渡す', async () => {
    const searchFn = vi.fn().mockResolvedValue({ hitCount: 0, latestQuestions: [] });
    await interpretAichatSlashCommand('/neko search 東京 駅', now, {
      fetchLatestCommitAgentLog: async () => null,
      searchShares: searchFn,
    });
    expect(searchFn).toHaveBeenCalledWith('東京 駅');
  });

  it('キーワード未指定の場合はdepsを呼ばずに使い方を案内する', async () => {
    const searchFn = vi.fn().mockRejectedValue(new Error('should not be called'));
    const result = await interpretAichatSlashCommand('/neko search', now, {
      fetchLatestCommitAgentLog: async () => null,
      searchShares: searchFn,
    });
    expect(searchFn).not.toHaveBeenCalled();
    expect(result).toEqual({ handled: true, response: formatAichatSearchResults('', { hitCount: 0, latestQuestions: [] }) });
  });

  it('未対応コマンドのヘルプ・/neko helpに /neko search を含める', async () => {
    const deps = { fetchLatestCommitAgentLog: async () => null };
    const unknown = await interpretAichatSlashCommand('/neko unknown', now, deps);
    expect(unknown.handled).toBe(true);
    if (!unknown.handled) throw new Error('not handled');
    expect(unknown.response).toContain('/neko search');

    const help = await interpretAichatSlashCommand('/neko help', now, deps);
    expect(help.handled).toBe(true);
    if (!help.handled) throw new Error('not handled');
    expect(help.response).toContain('/neko search');
    expect(help.response).toContain('ヒット件数');
    expect(help.response).toContain('最新5件');
  });
});

// 対象: searchShares(DB問い合わせ)がデータ量等の理由で長時間応答しない
// 場合に、応答バブルが「考え中...」のまま無期限に固まって見える
// (ユーザーからは「AIに問い合わせに行ったままハングアップする」ように
// 見える)ことを防ぐためのタイムアウト処理。
//
// 故障シナリオ:
//   (1) DB問い合わせが応答しない場合に永久に待ち続けてしまう(ハング)
//   (2) DB問い合わせが例外を投げた場合に、エラーメッセージを返さず
//       握りつぶしてしまう(CLAUDE.mdルール8: 記録・通知の義務)
//   (3) タイムアウト発生後もタイマーが残り続ける、または元のPromiseの
//       解決/拒否時に未捕捉の例外(unhandled rejection)が発生する

describe('interpretAichatSlashCommand: /neko search のタイムアウト・エラー処理', () => {
  const now = new Date('2026-07-15T00:00:00.000Z');

  afterEach(() => {
    vi.useRealTimers();
  });

  it(`searchSharesが${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答しない場合はタイムアウトの案内を返す(ハングしない)`, async () => {
    vi.useFakeTimers();
    const neverResolves = new Promise<AichatSearchOutcome>(() => {});
    const searchFn = vi.fn().mockReturnValue(neverResolves);

    const resultPromise = interpretAichatSlashCommand('/neko search 駅', now, {
      fetchLatestCommitAgentLog: async () => null,
      searchShares: searchFn,
    });
    await vi.advanceTimersByTimeAsync(AICHAT_SEARCH_TIMEOUT_MS);
    const result = await resultPromise;

    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('タイムアウト');
    expect(result.response).toContain('/neko search');
  });

  it('タイムアウト時間より前に応答すれば、通常どおり検索結果を返す', async () => {
    vi.useFakeTimers();
    const outcome: AichatSearchOutcome = { hitCount: 1, latestQuestions: ['質問A'] };
    const searchFn = vi.fn().mockResolvedValue(outcome);

    const resultPromise = interpretAichatSlashCommand('/neko search 駅', now, {
      fetchLatestCommitAgentLog: async () => null,
      searchShares: searchFn,
    });
    await vi.advanceTimersByTimeAsync(10);
    const result = await resultPromise;

    expect(result).toEqual({ handled: true, response: formatAichatSearchResults('駅', outcome) });
  });

  it('searchSharesが例外を投げた場合は握りつぶさずエラーメッセージを返す', async () => {
    const searchFn = vi.fn().mockRejectedValue(new Error('D1 query failed'));
    const result = await interpretAichatSlashCommand('/neko search 駅', now, {
      fetchLatestCommitAgentLog: async () => null,
      searchShares: searchFn,
    });

    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('エラー');
    expect(result.response).toContain('D1 query failed');
  });
});
