import { describe, expect, it, vi } from 'vitest';
import { interpretAichatSlashCommand, parseNekoSearchArguments } from './utils/aichatSlashCommand';

const deps = { fetchLatestCommitAgentLog: async () => null };

describe('/neko s', () => {
  it('半角スペース区切りと引用符内のスペースを検索語として解析する', () => {
    expect(parseNekoSearchArguments('猫 "東京 駅" \u201c大阪 城\u201d 犬')).toEqual(['猫', '東京 駅', '大阪 城', '犬']);
  });

  it('各引数をループ元として過去ログ検索APIを呼び、結果を重複排除する', async () => {
    const searchShares = vi.fn(async (keyword: string) => ({
      hitCount: keyword === '東京 駅' ? 2 : 1,
      results: keyword === '東京 駅'
        ? [{ id: '1', question: '共通ログ' }, { id: '2', question: '東京駅ログ' }]
        : [{ id: '1', question: '共通ログ' }],
    }));

    const result = await interpretAichatSlashCommand('/neko s 猫 "東京 駅"', new Date(), { ...deps, searchShares });

    expect(searchShares.mock.calls.map(([keyword]) => keyword)).toEqual(['猫', '東京 駅']);
    expect(result).toEqual({
      handled: true,
      response: '過去ログを検索しました:\n- 「猫」: 1件\n- 「東京 駅」: 2件',
      resultsForModal: [{ id: '1', question: '共通ログ' }, { id: '2', question: '東京駅ログ' }],
    });
  });

  it('引数がない場合は使い方を返し、APIを呼ばない', async () => {
    const searchShares = vi.fn();
    const result = await interpretAichatSlashCommand('/neko s', new Date(), { ...deps, searchShares });
    expect(result).toEqual({ handled: true, response: '❌ 検索語を指定してください: /neko s <検索語 ...>' });
    expect(searchShares).not.toHaveBeenCalled();
  });
});
