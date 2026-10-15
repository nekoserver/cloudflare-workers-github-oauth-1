import { describe, it, expect } from 'vitest';
import { dedupeKeywords, buildKeywordOccurrenceResults } from './treeViewKeywordOccurrence';

// 対象: POST /api/tree-view-keyword-occurrence-externalが使う集計ロジック
// (dedupeKeywords・buildKeywordOccurrenceResults)。
//
// 故障シナリオ:
//   (1) 同じキーワードが複数ファイル・複数コミットから重複して出てくる
//   (2) 前後に空白が付いたキーワードが別物として扱われてしまう
//   (3) AIチャットで一度も検索されていないキーワードが黙って除外される
//   (4) countRowsに同一keywordの行が複数ある(本来GROUP BY済みのはずだが防御的に)
//   (5) 出現回数が同数の場合に表示順が安定しない

describe('dedupeKeywords', () => {
  it('重複するキーワード行を1件にまとめる', () => {
    expect(dedupeKeywords([{ keyword: 'リファクタ' }, { keyword: 'リファクタ' }, { keyword: 'テスト' }])).toEqual([
      'リファクタ',
      'テスト',
    ]);
  });

  it('前後の空白をtrimしてから重複判定する', () => {
    expect(dedupeKeywords([{ keyword: ' リファクタ ' }, { keyword: 'リファクタ' }])).toEqual(['リファクタ']);
  });

  it('空文字列・空白のみの行は除外する', () => {
    expect(dedupeKeywords([{ keyword: '' }, { keyword: '   ' }, { keyword: 'テスト' }])).toEqual(['テスト']);
  });
});

describe('buildKeywordOccurrenceResults', () => {
  it('AIチャットで一度も検索されていないキーワードも出現回数0として出力する(黙って除外しない)', () => {
    const result = buildKeywordOccurrenceResults(['未検索キーワード'], []);
    expect(result).toEqual([{ keyword: '未検索キーワード', occurrenceCount: 0 }]);
  });

  it('出現回数の多い順に並べる', () => {
    const result = buildKeywordOccurrenceResults(
      ['少', '多', '中'],
      [
        { keyword: '少', cnt: 1 },
        { keyword: '多', cnt: 10 },
        { keyword: '中', cnt: 5 },
      ],
    );
    expect(result.map((r) => r.keyword)).toEqual(['多', '中', '少']);
  });

  it('出現回数が同数の場合はキーワードの文字コード順で安定的に並ぶ', () => {
    const result = buildKeywordOccurrenceResults(
      ['b', 'a'],
      [
        { keyword: 'b', cnt: 3 },
        { keyword: 'a', cnt: 3 },
      ],
    );
    expect(result.map((r) => r.keyword)).toEqual(['a', 'b']);
  });

  it('countRowsに同一keywordの行が複数あっても合算する(防御的)', () => {
    const result = buildKeywordOccurrenceResults(
      ['重複キー'],
      [
        { keyword: '重複キー', cnt: 2 },
        { keyword: '重複キー', cnt: 3 },
      ],
    );
    expect(result).toEqual([{ keyword: '重複キー', occurrenceCount: 5 }]);
  });

  it('抽出キーワードが重複していても1件にまとめる', () => {
    const result = buildKeywordOccurrenceResults(['同じ', '同じ'], [{ keyword: '同じ', cnt: 4 }]);
    expect(result).toEqual([{ keyword: '同じ', occurrenceCount: 4 }]);
  });

  it('cntがnullの行は0として扱う', () => {
    const result = buildKeywordOccurrenceResults(['キー'], [{ keyword: 'キー', cnt: null }]);
    expect(result).toEqual([{ keyword: 'キー', occurrenceCount: 0 }]);
  });
});
