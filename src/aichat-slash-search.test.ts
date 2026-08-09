import { describe, expect, it, vi } from 'vitest';
import { formatAichatSearchResults, interpretAichatSlashCommand, type AichatSearchResultRow } from './utils/aichatSlashCommand';

// 対象: AIチャットの入力窓 `/neko search <キーワード>` サブコマンド。
// 質問文・回答文にキーワードを含む共有(searchAiChatShares相当)を、
// 回答文に含まれる登録済みキーワード数(keywordCount、
// enrichSearchResultsWithKeywordCounts相当)の多い順に並べ替えて
// 応答バブル内にMarkdownで表示する。
//
// 故障シナリオ:
//   (1) キーワード数の多い順に並び替えられず、検索元の順序(日時順)の
//       ままになってしまう
//   (2) キーワード未指定の場合に例外になる、またはAI呼び出しへ委ねられてしまう
//   (3) 検索結果が0件の場合に空文字やundefinedを返して握りつぶす
//   (4) 同数のキーワード数の場合に順序が不安定(元の順序を保たない)

describe('formatAichatSearchResults', () => {
  it('キーワード数(keywordCount)の多い順に並び替えて箇条書きで表示する', () => {
    const results: AichatSearchResultRow[] = [
      { id: 's1', user_hash: 'h1', question: '東京駅について', keywordCount: 1 },
      { id: 's2', user_hash: 'h2', question: '新幹線について', keywordCount: 5 },
      { id: 's3', user_hash: 'h3', question: '乗車券について', keywordCount: 3 },
    ];
    const text = formatAichatSearchResults('駅', results);
    const order = ['新幹線について', '乗車券について', '東京駅について'];
    let lastIdx = -1;
    order.forEach((q) => {
      const idx = text.indexOf(q);
      expect(idx).toBeGreaterThan(lastIdx);
      lastIdx = idx;
    });
  });

  it('各行にキーワード数と/s/へのMarkdownリンクを含める', () => {
    const results: AichatSearchResultRow[] = [
      { id: 's1', user_hash: 'h1', question: '東京駅について', keywordCount: 2 },
    ];
    const text = formatAichatSearchResults('駅', results);
    expect(text).toContain('[東京駅について](/s/h1/s1)');
    expect(text).toContain('キーワード数: 2');
  });

  it('検索結果が0件の場合はその旨を返す(握りつぶさない)', () => {
    const text = formatAichatSearchResults('見つからないキーワード', []);
    expect(text).toContain('見つからないキーワード');
    expect(text).toContain('見つかりませんでした');
  });

  it('キーワード未指定の場合は使い方を案内する', () => {
    const text = formatAichatSearchResults('', []);
    expect(text).toContain('/neko search');
  });

  it('同数のキーワード数の場合は渡された順序を保つ(安定ソート)', () => {
    const results: AichatSearchResultRow[] = [
      { id: 's1', user_hash: 'h1', question: '先に渡した方', keywordCount: 2 },
      { id: 's2', user_hash: 'h2', question: '後に渡した方', keywordCount: 2 },
    ];
    const text = formatAichatSearchResults('駅', results);
    expect(text.indexOf('先に渡した方')).toBeLessThan(text.indexOf('後に渡した方'));
  });

  it('罫線・ツリー文字を使わない(CLAUDE.mdルール16)', () => {
    const results: AichatSearchResultRow[] = [
      { id: 's1', user_hash: 'h1', question: '東京駅について', keywordCount: 2 },
    ];
    expect(formatAichatSearchResults('駅', results)).not.toMatch(/[├└│─┼]/);
  });
});

describe('interpretAichatSlashCommand: /neko search', () => {
  const now = new Date('2026-07-15T00:00:00.000Z');

  it('/neko search <キーワード> はdepsのsearchSharesWithKeywordCountsへキーワードを渡し、結果を整形して返す', async () => {
    const results: AichatSearchResultRow[] = [
      { id: 's1', user_hash: 'h1', question: '東京駅について', keywordCount: 1 },
      { id: 's2', user_hash: 'h2', question: '新幹線について', keywordCount: 5 },
    ];
    const searchFn = vi.fn().mockResolvedValue(results);
    const result = await interpretAichatSlashCommand('/neko search 駅', now, {
      fetchLatestCommitAgentLog: async () => null,
      searchSharesWithKeywordCounts: searchFn,
    });
    expect(searchFn).toHaveBeenCalledWith('駅');
    expect(result).toEqual({ handled: true, response: formatAichatSearchResults('駅', results) });
  });

  it('キーワードに空白を含む場合は"search"以降をすべて連結してキーワードとして渡す', async () => {
    const searchFn = vi.fn().mockResolvedValue([]);
    await interpretAichatSlashCommand('/neko search 東京 駅', now, {
      fetchLatestCommitAgentLog: async () => null,
      searchSharesWithKeywordCounts: searchFn,
    });
    expect(searchFn).toHaveBeenCalledWith('東京 駅');
  });

  it('キーワード未指定の場合はdepsを呼ばずに使い方を案内する', async () => {
    const searchFn = vi.fn().mockRejectedValue(new Error('should not be called'));
    const result = await interpretAichatSlashCommand('/neko search', now, {
      fetchLatestCommitAgentLog: async () => null,
      searchSharesWithKeywordCounts: searchFn,
    });
    expect(searchFn).not.toHaveBeenCalled();
    expect(result).toEqual({ handled: true, response: formatAichatSearchResults('', []) });
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
  });
});
