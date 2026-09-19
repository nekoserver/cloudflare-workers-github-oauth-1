import { describe, expect, it } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';
import { extractFunctionSource } from './utils/extractFunctionSource';

// 対象: /answer-graph ページの「再チェック」ボタン(#answerModalKeywordRecheckBtn)
// および「キーワード一覧」ボタン(#answerModalKeywordListBtn)が使う判定ロジックを
// DOM操作から切り離した純関数。
//   - selectUnregisteredKeywords(keywords): keywordCountMapを基準に未登録の
//     キーワードだけを抽出する(renderPrereqModal/「再チェック」フロー用)
//   - selectUnregisteredKeywordOccurrences(keywordOccurrences): count=0の
//     出現回数エントリだけを抽出する(renderPrereqKeywordOccurrenceList/
//     「キーワード一覧」フロー用)
//   - buildAnswerKeywordsFetchErrorMessage(d, actionLabel): /api/aichat/
//     answer-keywordsのレスポンスから失敗時のアラート文言を組み立てる
//     (両ボタン共通)
//
// これまではDOM生成関数(renderPrereqModal等)の内部にロジックが直書きされ、
// テストもページ全体をDOMへ注入してイベント発火経由で間接的に検証する
// (モック地獄の一歩手前の)形になっていた不具合の再発防止
// (CLAUDE.mdルール15: 関数抽出→ユニットテスト→ハンドラから呼び出し、の順)。
//
// 故障シナリオ:
//   (1) 出現回数0件のキーワードが「登録済み」判定されてしまう
//   (2) 出現回数1件以上のキーワードが「未登録」判定されてしまう
//   (3) keywords/keywordOccurrencesがnull/undefined/空配列でも例外を投げる
//   (4) レスポンスにerrorが無いのに失敗扱いのメッセージを組み立ててしまう
//   (5) レスポンス自体がnull/undefinedの場合にメッセージ組み立てが失敗する

function buildPage(): string {
  return getAnswerGraphPage('testuser', {}, false);
}

function loadSelectUnregisteredKeywords(keywordCountMap: Record<string, number>) {
  const html = buildPage();
  const source = extractFunctionSource(html, 'selectUnregisteredKeywords');
  const dep = extractFunctionSource(html, 'isKeywordRegisteredInBarCache');
  expect(source).toBeTruthy();
  expect(dep).toBeTruthy();
  return new Function(
    `var keywordCountMap = ${JSON.stringify(keywordCountMap)};\n${dep}\n${source}\nreturn selectUnregisteredKeywords;`
  )() as (keywords: string[] | null | undefined) => string[];
}

function loadSelectUnregisteredKeywordOccurrences() {
  const html = buildPage();
  const source = extractFunctionSource(html, 'selectUnregisteredKeywordOccurrences');
  expect(source).toBeTruthy();
  return new Function(`${source}\nreturn selectUnregisteredKeywordOccurrences;`)() as (
    keywordOccurrences: Array<{ keyword: string; count: number }> | null | undefined
  ) => Array<{ keyword: string; count: number }>;
}

function loadBuildAnswerKeywordsFetchErrorMessage() {
  const html = buildPage();
  const source = extractFunctionSource(html, 'buildAnswerKeywordsFetchErrorMessage');
  expect(source).toBeTruthy();
  return new Function(`${source}\nreturn buildAnswerKeywordsFetchErrorMessage;`)() as (
    d: { error?: string } | null | undefined,
    actionLabel: string
  ) => string | null;
}

describe('selectUnregisteredKeywords: keywordCountMap基準で未登録キーワードを抽出する純関数', () => {
  it('出現回数0件のキーワードだけを未登録として返す', () => {
    const selectUnregistered = loadSelectUnregisteredKeywords({ '新幹線': 3 });
    expect(selectUnregistered(['新幹線', '乗車券'])).toEqual(['乗車券']);
  });

  it('全キーワードが登録済みなら空配列を返す', () => {
    const selectUnregistered = loadSelectUnregisteredKeywords({ '新幹線': 3, '乗車券': 1 });
    expect(selectUnregistered(['新幹線', '乗車券'])).toEqual([]);
  });

  it('keywordCountMapに存在しないキーワードは未登録扱いになる', () => {
    const selectUnregistered = loadSelectUnregisteredKeywords({});
    expect(selectUnregistered(['未知語'])).toEqual(['未知語']);
  });

  it('keywordsがnull/undefined/空配列でも例外を投げず空配列を返す', () => {
    const selectUnregistered = loadSelectUnregisteredKeywords({});
    expect(selectUnregistered(null as unknown as string[])).toEqual([]);
    expect(selectUnregistered(undefined as unknown as string[])).toEqual([]);
    expect(selectUnregistered([])).toEqual([]);
  });
});

describe('selectUnregisteredKeywordOccurrences: 出現回数0件のエントリだけを抽出する純関数', () => {
  it('count=0のエントリだけを返す', () => {
    const selectUnregistered = loadSelectUnregisteredKeywordOccurrences();
    const result = selectUnregistered([
      { keyword: '新幹線', count: 3 },
      { keyword: '乗車券', count: 0 },
    ]);
    expect(result).toEqual([{ keyword: '乗車券', count: 0 }]);
  });

  it('全件count>0なら空配列を返す', () => {
    const selectUnregistered = loadSelectUnregisteredKeywordOccurrences();
    expect(selectUnregistered([{ keyword: '新幹線', count: 3 }])).toEqual([]);
  });

  it('keywordOccurrencesがnull/undefined/空配列でも例外を投げず空配列を返す', () => {
    const selectUnregistered = loadSelectUnregisteredKeywordOccurrences();
    expect(selectUnregistered(null)).toEqual([]);
    expect(selectUnregistered(undefined)).toEqual([]);
    expect(selectUnregistered([])).toEqual([]);
  });
});

describe('buildAnswerKeywordsFetchErrorMessage: /api/aichat/answer-keywordsレスポンスから失敗時のアラート文言を組み立てる純関数', () => {
  it('エラーが無ければnullを返す(成功扱い)', () => {
    const build = loadBuildAnswerKeywordsFetchErrorMessage();
    expect(build({ error: undefined }, '再チェック')).toBeNull();
  });

  it('d.errorがある場合、その内容を含む文言を返す', () => {
    const build = loadBuildAnswerKeywordsFetchErrorMessage();
    expect(build({ error: 'D1接続エラー' }, '再チェック')).toBe('再チェックに失敗しました: D1接続エラー');
  });

  it('dがnull/undefinedの場合、不明なエラーとして文言を返す', () => {
    const build = loadBuildAnswerKeywordsFetchErrorMessage();
    expect(build(null, 'キーワード一覧の取得')).toBe('キーワード一覧の取得に失敗しました: 不明なエラー');
    expect(build(undefined, 'キーワード一覧の取得')).toBe('キーワード一覧の取得に失敗しました: 不明なエラー');
  });

  it('actionLabelが呼び出し元ごとに文言へ反映される', () => {
    const build = loadBuildAnswerKeywordsFetchErrorMessage();
    expect(build({ error: 'x' }, '再チェック')).toContain('再チェックに失敗しました');
    expect(build({ error: 'x' }, 'キーワード一覧の取得')).toContain('キーワード一覧の取得に失敗しました');
  });
});
