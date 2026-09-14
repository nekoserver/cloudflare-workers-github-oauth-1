import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  AICHAT_QSEARCH_LIMIT,
  AICHAT_SEARCH_TIMEOUT_MS,
  buildAichatQsearchIdHref,
  formatAichatNekoQsearchResults,
  formatAichatQsearchAnswerText,
  formatAichatQsearchModelName,
  formatAichatSlashCommandHelp,
  interpretAichatSlashCommand,
  mapAiChatSharesToQsearchItems,
  parseAichatQsearchHref,
  type AichatQsearchItem,
  type AichatSearchOutcome,
} from './utils/aichatSlashCommand';

// 対象: AIチャット入力窓のスラッシュコマンド `/neko qsearch <キーワード>`。
// AI応答の過去ログ(ai_chat_shares)を質問文・回答文の両方で検索し、
// ヒットした質問文と回答モデルをMarkdown表で返す。行頭は質問IDリンク。
// /neko search は件数のみ。/neko csearch は Cursor VM 履歴であり混ぜない。
//
// 故障シナリオ:
//   (1) キーワード未指定でAI呼び出しへ委ねる、または例外になる
//   (2) ヒット0件を空文字で握りつぶす
//   (3) ヒットがあるのに質問文表が応答に無い(件数だけになる)
//   (4) searchCursorAgentHistoryを呼んでCursor VM履歴と混ざる
//   (5) モデル名欠落を空文字で握りつぶす
//   (6) 検索例外・タイムアウトを握りつぶす
//   (7) 質問文のパイプでMarkdown表が壊れる
//   (8) 行頭に質問IDリンクが無く、質問IDをAPIへ渡せない
//   (9) 最新回答の失敗を空文字で握りつぶす

describe('formatAichatQsearchModelName', () => {
  it('フルパスのモデル名は末尾だけにする', () => {
    expect(formatAichatQsearchModelName('@cf/meta/llama-3.3-70b-instruct-fp8-fast'))
      .toBe('llama-3.3-70b-instruct-fp8-fast');
  });

  it('スラッシュ無しはそのまま使う', () => {
    expect(formatAichatQsearchModelName('gpt-5')).toBe('gpt-5');
  });

  it('欠落は空にせずプレースホルダにする', () => {
    expect(formatAichatQsearchModelName(null)).toBe('(モデル不明)');
    expect(formatAichatQsearchModelName('')).toBe('(モデル不明)');
    expect(formatAichatQsearchModelName('   ')).toBe('(モデル不明)');
  });
});

describe('mapAiChatSharesToQsearchItems', () => {
  it('質問文とモデルを載せ、上限件数で切る', () => {
    const rows = Array.from({ length: AICHAT_QSEARCH_LIMIT + 5 }, (_, i) => ({
      id: `s${i + 1}`,
      question: `質問${i + 1}`,
      model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    }));
    const items = mapAiChatSharesToQsearchItems(rows);
    expect(items).toHaveLength(AICHAT_QSEARCH_LIMIT);
    expect(items[0]).toEqual({
      id: 's1',
      question: '質問1',
      model: 'llama-3.3-70b-instruct-fp8-fast',
    });
  });

  it('空の質問文は握りつぶさずプレースホルダにする', () => {
    expect(mapAiChatSharesToQsearchItems([{ id: 's9', question: '  \n', model: 'm' }])).toEqual([
      { id: 's9', question: '(質問文なし)', model: 'm' },
    ]);
  });

  it('改行はセル崩壊を避けるため空白に潰す', () => {
    expect(mapAiChatSharesToQsearchItems([{ id: 's2', question: '一行目\n二行目', model: 'gpt-5' }])).toEqual([
      { id: 's2', question: '一行目 二行目', model: 'gpt-5' },
    ]);
  });
});

describe('buildAichatQsearchIdHref / parseAichatQsearchHref', () => {
  it('質問IDと言語モデルをクエリパラメータとして付ける', () => {
    const href = buildAichatQsearchIdHref({
      id: 's1',
      question: '東京駅について',
      model: 'llama-3.3-70b-instruct-fp8-fast',
    });
    expect(href).toBe('#qsearch?id=s1&model=llama-3.3-70b-instruct-fp8-fast');
    const parsed = parseAichatQsearchHref(href);
    expect(parsed).toEqual({ id: 's1', model: 'llama-3.3-70b-instruct-fp8-fast' });
    expect(href).not.toContain('question=');
    expect(href).not.toContain('answer=');
  });

  it('閉じ括弧を含む質問IDでもhrefの ) でMarkdownリンクが壊れない', () => {
    const href = buildAichatQsearchIdHref({
      id: 's9(tokyo)',
      question: '駅について',
      model: 'gpt-5',
    });
    expect(href).not.toContain(')');
    expect(parseAichatQsearchHref(href)?.id).toBe('s9(tokyo)');
  });

  it('qsearch以外のhrefはnullを返す(握りつぶして空文字にしない)', () => {
    expect(parseAichatQsearchHref('#csearch-11')).toBeNull();
    expect(parseAichatQsearchHref('')).toBeNull();
    expect(parseAichatQsearchHref(null)).toBeNull();
  });
});

describe('formatAichatQsearchAnswerText', () => {
  it('回答文があればそれを返す', () => {
    expect(formatAichatQsearchAnswerText({ answer: '## 結論\n\n**駅**です' })).toBe('## 結論\n\n**駅**です');
  });

  it('errorがあれば回答文よりエラーを優先し、空にしない', () => {
    expect(formatAichatQsearchAnswerText({ error: '見つかりません', answer: '古い' })).toBe('見つかりません');
  });

  it('回答欠落は空にせず案内する', () => {
    expect(formatAichatQsearchAnswerText({ answer: '' })).toBe('回答文がありません');
    expect(formatAichatQsearchAnswerText({})).toBe('回答文がありません');
  });
});

describe('formatAichatNekoQsearchResults', () => {
  it('ヒット時は件数の代わりに質問ID・質問文・モデルのMarkdown表を出す', () => {
    const results: AichatQsearchItem[] = [
      { id: 's1', question: '東京駅について', model: 'llama-3.3-70b-instruct-fp8-fast' },
      { id: 's2', question: '新幹線について', model: 'gpt-5' },
    ];
    const text = formatAichatNekoQsearchResults('駅', { results });
    expect(text).toContain('AIチャット過去ログ検索');
    expect(text).toContain('駅');
    expect(text).toContain('| 質問ID | 質問文 | モデル |');
    expect(text).toContain(`[s1](${buildAichatQsearchIdHref(results[0])})`);
    expect(text).toContain('| 東京駅について | llama-3.3-70b-instruct-fp8-fast |');
    expect(text).toContain(`[s2](${buildAichatQsearchIdHref(results[1])})`);
    expect(text).toContain('| 新幹線について | gpt-5 |');
    expect(text).not.toMatch(/ヒット.*件/);
    expect(text).not.toMatch(/[├└│─┼]/);
  });

  it('ヒット0件は0件と明示し表を出さない(握りつぶさない)', () => {
    const text = formatAichatNekoQsearchResults('見つからない', { results: [] });
    expect(text).toContain('見つからない');
    expect(text).toContain('0件');
    expect(text).not.toContain('| 質問ID | 質問文 | モデル |');
  });

  it('キーワード未指定は使い方を案内する', () => {
    const text = formatAichatNekoQsearchResults('', { results: [] });
    expect(text).toContain('/neko qsearch');
  });

  it('質問文のパイプはMarkdown表が壊れないようエスケープする', () => {
    const text = formatAichatNekoQsearchResults('x', {
      results: [{ id: 's1', question: 'A|B', model: 'gpt-5' }],
    });
    expect(text).toContain('A\\|B');
  });
});

describe('interpretAichatSlashCommand: /neko qsearch', () => {
  const now = new Date('2026-09-14T00:00:00.000Z');
  const unusedLog = async () => null;

  it('/neko qsearch <キーワード> はsearchSharesへ渡し、質問文とモデルの表を返す', async () => {
    const outcome: AichatSearchOutcome = {
      hitCount: 2,
      results: [
        { id: 's1', question: '東京駅について', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
        { id: 's2', question: '新幹線について', model: 'gpt-5' },
      ],
    };
    const searchFn = vi.fn().mockResolvedValue(outcome);
    const searchCursor = vi.fn();
    const result = await interpretAichatSlashCommand('/neko qsearch 駅', now, {
      fetchLatestCommitAgentLog: unusedLog,
      searchShares: searchFn,
      searchCursorAgentHistory: searchCursor,
    });
    expect(searchFn).toHaveBeenCalledWith('駅');
    expect(searchCursor).not.toHaveBeenCalled();
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toBe(formatAichatNekoQsearchResults('駅', {
      results: mapAiChatSharesToQsearchItems(outcome.results),
    }));
    expect(result.resultsForModal).toBeUndefined();
    expect(result.cursorResultsForModal).toBeUndefined();
  });

  it('ヒット0件は表を出さずcursorResultsForModalも付けない', async () => {
    const searchFn = vi.fn().mockResolvedValue({ hitCount: 0, results: [] });
    const result = await interpretAichatSlashCommand('/neko qsearch 駅', now, {
      fetchLatestCommitAgentLog: unusedLog,
      searchShares: searchFn,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('0件');
    expect(result.resultsForModal).toBeUndefined();
  });

  it('キーワードの空白は連結して渡す', async () => {
    const searchFn = vi.fn().mockResolvedValue({ hitCount: 0, results: [] });
    await interpretAichatSlashCommand('/neko qsearch 東京 駅', now, {
      fetchLatestCommitAgentLog: unusedLog,
      searchShares: searchFn,
    });
    expect(searchFn).toHaveBeenCalledWith('東京 駅');
  });

  it('キーワード未指定はdepsを呼ばず使い方を返す', async () => {
    const searchFn = vi.fn();
    const result = await interpretAichatSlashCommand('/neko qsearch', now, {
      fetchLatestCommitAgentLog: unusedLog,
      searchShares: searchFn,
    });
    expect(searchFn).not.toHaveBeenCalled();
    expect(result).toEqual({
      handled: true,
      response: formatAichatNekoQsearchResults('', { results: [] }),
    });
  });

  it('検索API未設定は握りつぶさず案内する', async () => {
    const result = await interpretAichatSlashCommand('/neko qsearch 駅', now, {
      fetchLatestCommitAgentLog: unusedLog,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('/neko qsearch');
    expect(result.response).toContain('利用できません');
  });

  it('未対応コマンドと /neko help に /neko qsearch を含める', async () => {
    const deps = { fetchLatestCommitAgentLog: unusedLog };
    const unknown = await interpretAichatSlashCommand('/neko unknown', now, deps);
    expect(unknown.handled).toBe(true);
    if (!unknown.handled) throw new Error('not handled');
    expect(unknown.response).toContain('/neko qsearch');

    const help = await interpretAichatSlashCommand('/neko help', now, deps);
    expect(help.handled).toBe(true);
    if (!help.handled) throw new Error('not handled');
    expect(help.response).toContain('/neko qsearch');
    expect(formatAichatSlashCommandHelp()).toContain('質問ID');
  });

  it('誤記 qseqrch は未対応として扱い、qsearch を案内する', async () => {
    const searchFn = vi.fn();
    const result = await interpretAichatSlashCommand('/neko qseqrch 駅', now, {
      fetchLatestCommitAgentLog: unusedLog,
      searchShares: searchFn,
    });
    expect(searchFn).not.toHaveBeenCalled();
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('未対応');
    expect(result.response).toContain('/neko qsearch');
    expect(result.response).not.toContain('/neko qseqrch');
  });
});

describe('interpretAichatSlashCommand: /neko qsearch のタイムアウト・エラー処理', () => {
  const now = new Date('2026-09-14T00:00:00.000Z');

  afterEach(() => {
    vi.useRealTimers();
  });

  it(`searchSharesが${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答しない場合はタイムアウト案内を返す`, async () => {
    vi.useFakeTimers();
    const neverResolves = new Promise<AichatSearchOutcome>(() => {});
    const searchFn = vi.fn().mockReturnValue(neverResolves);
    const resultPromise = interpretAichatSlashCommand('/neko qsearch 駅', now, {
      fetchLatestCommitAgentLog: async () => null,
      searchShares: searchFn,
    });
    await vi.advanceTimersByTimeAsync(AICHAT_SEARCH_TIMEOUT_MS);
    const result = await resultPromise;
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('タイムアウト');
    expect(result.response).toContain('/neko qsearch');
  });

  it('searchSharesが例外を投げた場合は握りつぶさずエラーを返す', async () => {
    const searchFn = vi.fn().mockRejectedValue(new Error('D1 query failed'));
    const result = await interpretAichatSlashCommand('/neko qsearch 駅', now, {
      fetchLatestCommitAgentLog: async () => null,
      searchShares: searchFn,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('エラー');
    expect(result.response).toContain('D1 query failed');
  });
});
