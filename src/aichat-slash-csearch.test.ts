import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  AICHAT_CSEARCH_LIMIT,
  AICHAT_SEARCH_TIMEOUT_MS,
  formatAichatNekoCsearchResults,
  formatAichatSlashCommandHelp,
  formatCursorAgentCsearchAnswerText,
  interpretAichatSlashCommand,
  mapCursorAgentHistoryToCsearchItems,
  type CursorAgentCsearchItem,
  type CursorAgentCsearchOutcome,
} from './utils/aichatSlashCommand';

// 対象: AIチャット入力窓の `/neko csearch <キーワード>`。
// Cursor VM(courts)の起動履歴を queryCursorAgentHistoryWithSearch 相当の
// APIで検索し、ヒット有無の件数だけにせず質問文を表で返す。
// 回答全文はチャット本文に出さず、リンク経由でキャッシュから読む。
// /neko search(ai_chat_shares)とはコーパスを混ぜない。0140へは書かない。
//
// 故障シナリオ:
//   (1) キーワード未指定でAI呼び出しへ委ねる、または例外になる
//   (2) ヒット0件を空文字で握りつぶす
//   (3) ヒットがあるのに質問文表が応答に無い
//   (4) searchSharesを呼んでAIチャット過去ログと混ざる
//   (5) 検索例外を握りつぶす
//   (6) 検索が返らず応答バブルが「考え中」のまま固まる

describe('mapCursorAgentHistoryToCsearchItems', () => {
  it('promptを質問文にし、上限件数で切る', () => {
    const rows = Array.from({ length: AICHAT_CSEARCH_LIMIT + 5 }, (_, i) => ({
      id: i + 1,
      prompt: `質問${i + 1}`,
    }));
    const items = mapCursorAgentHistoryToCsearchItems(rows);
    expect(items).toHaveLength(AICHAT_CSEARCH_LIMIT);
    expect(items[0]).toEqual({ id: 1, question: '質問1' });
    expect(items[AICHAT_CSEARCH_LIMIT - 1].id).toBe(AICHAT_CSEARCH_LIMIT);
  });

  it('空のpromptは握りつぶさずプレースホルダにする', () => {
    expect(mapCursorAgentHistoryToCsearchItems([{ id: 9, prompt: '  \n' }])).toEqual([
      { id: 9, question: '(質問文なし)' },
    ]);
  });

  it('改行はセル崩壊を避けるため空白に潰す', () => {
    expect(mapCursorAgentHistoryToCsearchItems([{ id: 2, prompt: '一行目\n二行目' }])).toEqual([
      { id: 2, question: '一行目 二行目' },
    ]);
  });
});

describe('formatAichatNekoCsearchResults', () => {
  it('ヒット時は件数の代わりに質問文のMarkdown表と回答全文列を出す', () => {
    const outcome: CursorAgentCsearchOutcome = {
      results: [
        { id: 11, question: 'READMEを直して' },
        { id: 12, question: '検索フォールバック' },
      ],
    };
    const text = formatAichatNekoCsearchResults('readme', outcome);
    expect(text).toContain('Cursor VM 過去ログ検索');
    expect(text).toContain('readme');
    expect(text).toContain('| 質問文 | 回答全文 |');
    expect(text).toContain('| READMEを直して | 回答全文 |');
    expect(text).toContain('| 検索フォールバック | 回答全文 |');
    expect(text).not.toMatch(/ヒット.*件/);
    expect(text).not.toMatch(/[├└│─┼]/);
  });

  it('ヒット0件は0件と明示し表を出さない(握りつぶさない)', () => {
    const text = formatAichatNekoCsearchResults('見つからない', { results: [] });
    expect(text).toContain('見つからない');
    expect(text).toContain('0件');
    expect(text).not.toContain('| 質問文 | 回答全文 |');
  });

  it('検索診断エラーがある0件は警告を添える', () => {
    const text = formatAichatNekoCsearchResults('readme', {
      results: [],
      searchError: '回答キャッシュの検索に失敗しました: no such table',
    });
    expect(text).toContain('0件');
    expect(text).toContain('回答キャッシュの検索に失敗しました');
  });

  it('キーワード未指定は使い方を案内する', () => {
    const text = formatAichatNekoCsearchResults('', { results: [] });
    expect(text).toContain('/neko csearch');
  });

  it('質問文のパイプはMarkdown表が壊れないようエスケープする', () => {
    const text = formatAichatNekoCsearchResults('x', {
      results: [{ id: 1, question: 'A|B' }],
    });
    expect(text).toContain('A\\|B');
  });
});

describe('formatCursorAgentCsearchAnswerText', () => {
  it('キャッシュの回答文を結合して返す', () => {
    expect(formatCursorAgentCsearchAnswerText({ answers: ['前半', '後半'] })).toBe('前半\n\n後半');
  });

  it('空配列はキャッシュ無しとして明示する(握りつぶさない)', () => {
    expect(formatCursorAgentCsearchAnswerText({ answers: [] })).toBe('キャッシュに回答文がありません');
  });

  it('errorがあるときは回答が無くてもエラーを返す', () => {
    expect(formatCursorAgentCsearchAnswerText({ error: '見つかりません', answers: [] })).toBe('見つかりません');
  });

  it('cacheErrorは回答文の後に残す(ルール8)', () => {
    const text = formatCursorAgentCsearchAnswerText({
      answers: ['本文'],
      cacheError: '回答キャッシュの保存に失敗しました: boom',
    });
    expect(text).toContain('本文');
    expect(text).toContain('回答キャッシュの保存に失敗しました: boom');
  });
});

describe('interpretAichatSlashCommand: /neko csearch', () => {
  const now = new Date('2026-09-14T00:00:00.000Z');
  const unusedLog = async () => null;

  it('/neko csearch <キーワード> はCursor履歴検索へ渡し、質問文表とcursorResultsForModalを返す', async () => {
    const results: CursorAgentCsearchItem[] = [{ id: 7, question: 'Courtsのログを見て' }];
    const searchFn = vi.fn().mockResolvedValue({ results });
    const searchShares = vi.fn();
    const result = await interpretAichatSlashCommand('/neko csearch Courts', now, {
      fetchLatestCommitAgentLog: unusedLog,
      searchShares,
      searchCursorAgentHistory: searchFn,
    });
    expect(searchFn).toHaveBeenCalledWith('Courts');
    expect(searchShares).not.toHaveBeenCalled();
    expect(result).toEqual({
      handled: true,
      response: formatAichatNekoCsearchResults('Courts', { results }),
      cursorResultsForModal: results,
    });
  });

  it('ヒット0件はcursorResultsForModalを付けない', async () => {
    const searchFn = vi.fn().mockResolvedValue({ results: [] });
    const result = await interpretAichatSlashCommand('/neko csearch 駅', now, {
      fetchLatestCommitAgentLog: unusedLog,
      searchCursorAgentHistory: searchFn,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('0件');
    expect(result.cursorResultsForModal).toBeUndefined();
    expect(result.resultsForModal).toBeUndefined();
  });

  it('キーワードの空白は連結して渡す', async () => {
    const searchFn = vi.fn().mockResolvedValue({ results: [] });
    await interpretAichatSlashCommand('/neko csearch 東京 駅', now, {
      fetchLatestCommitAgentLog: unusedLog,
      searchCursorAgentHistory: searchFn,
    });
    expect(searchFn).toHaveBeenCalledWith('東京 駅');
  });

  it('キーワード未指定はdepsを呼ばず使い方を返す', async () => {
    const searchFn = vi.fn();
    const result = await interpretAichatSlashCommand('/neko csearch', now, {
      fetchLatestCommitAgentLog: unusedLog,
      searchCursorAgentHistory: searchFn,
    });
    expect(searchFn).not.toHaveBeenCalled();
    expect(result).toEqual({
      handled: true,
      response: formatAichatNekoCsearchResults('', { results: [] }),
    });
  });

  it('検索API未設定は握りつぶさず案内する', async () => {
    const result = await interpretAichatSlashCommand('/neko csearch 駅', now, {
      fetchLatestCommitAgentLog: unusedLog,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('/neko csearch');
    expect(result.response).toContain('利用できません');
  });

  it('未対応コマンドと /neko help に /neko csearch を含める', async () => {
    const deps = { fetchLatestCommitAgentLog: unusedLog };
    const unknown = await interpretAichatSlashCommand('/neko unknown', now, deps);
    expect(unknown.handled).toBe(true);
    if (!unknown.handled) throw new Error('not handled');
    expect(unknown.response).toContain('/neko csearch');

    const help = await interpretAichatSlashCommand('/neko help', now, deps);
    expect(help.handled).toBe(true);
    if (!help.handled) throw new Error('not handled');
    expect(help.response).toContain('/neko csearch');
    expect(formatAichatSlashCommandHelp()).toContain('Cursor VM');
  });
});

describe('interpretAichatSlashCommand: /neko csearch のタイムアウト・エラー処理', () => {
  const now = new Date('2026-09-14T00:00:00.000Z');

  afterEach(() => {
    vi.useRealTimers();
  });

  it(`searchCursorAgentHistoryが${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答しない場合はタイムアウト案内を返す`, async () => {
    vi.useFakeTimers();
    const neverResolves = new Promise<CursorAgentCsearchOutcome>(() => {});
    const searchFn = vi.fn().mockReturnValue(neverResolves);
    const resultPromise = interpretAichatSlashCommand('/neko csearch 駅', now, {
      fetchLatestCommitAgentLog: async () => null,
      searchCursorAgentHistory: searchFn,
    });
    await vi.advanceTimersByTimeAsync(AICHAT_SEARCH_TIMEOUT_MS);
    const result = await resultPromise;
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('タイムアウト');
    expect(result.response).toContain('/neko csearch');
  });

  it('searchCursorAgentHistoryが例外を投げた場合は握りつぶさずエラーを返す', async () => {
    const searchFn = vi.fn().mockRejectedValue(new Error('D1 query failed'));
    const result = await interpretAichatSlashCommand('/neko csearch 駅', now, {
      fetchLatestCommitAgentLog: async () => null,
      searchCursorAgentHistory: searchFn,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('エラー');
    expect(result.response).toContain('D1 query failed');
  });
});
