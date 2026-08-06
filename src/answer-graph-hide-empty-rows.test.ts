// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページの「この回答文のキーワード:」バーからキーワードを
// タップして再検索したあと、起点検索結果テーブルで「キーワード数0」の行・
// 経路が「ー」の行を表示しないようにする機能。設定ページの
// answerGraphHideEmptyRows設定(デフォルトON)で有効/無効を切り替えられる。
//
// 故障シナリオ:
//   (1) キーワードバーのチップをタップして再検索しても、キーワード数0・
//       経路「ー」の行が表示されたままになる
//   (2) 設定がOFFの場合でもチップ経由の再検索結果が絞り込まれてしまう
//   (3) 通常の検索窓への手入力による検索でも(意図せず)絞り込みが効いて
//       しまう、または一度チップ経由で絞り込んだ状態が手入力後も残る

function buildPage(hideEmptyRowsDefault?: boolean): string {
  return getAnswerGraphPage('testuser', {}, hideEmptyRowsDefault);
}

function loadPureFns(hideEmptyRowsDefault?: boolean) {
  const html = buildPage(hideEmptyRowsDefault);
  const idx = html.indexOf('function updateSearchSortIndicator');
  const endIdx = html.indexOf('function renderSearchResultsTable');
  expect(idx).toBeGreaterThan(-1);
  expect(endIdx).toBeGreaterThan(idx);
  const src = html.slice(idx, endIdx);
  const fn = new Function(`${src}\nreturn { shouldHideSearchResultRow: shouldHideSearchResultRow };`);
  return fn() as {
    shouldHideSearchResultRow: (r: { keywordCount?: number }, pathText: string, filterEmptyRows: boolean) => boolean;
  };
}

describe('shouldHideSearchResultRow: キーワード数0・経路「ー」の行を隠すかの判定', () => {
  it('filterEmptyRowsがfalseなら常に表示する(隠さない)', () => {
    const { shouldHideSearchResultRow } = loadPureFns();
    expect(shouldHideSearchResultRow({ keywordCount: 0 }, '—', false)).toBe(false);
  });

  it('filterEmptyRowsがtrueで、keywordCountが0なら隠す', () => {
    const { shouldHideSearchResultRow } = loadPureFns();
    expect(shouldHideSearchResultRow({ keywordCount: 0 }, '1. kw', true)).toBe(true);
  });

  it('filterEmptyRowsがtrueで、経路が「ー」なら隠す', () => {
    const { shouldHideSearchResultRow } = loadPureFns();
    expect(shouldHideSearchResultRow({ keywordCount: 2 }, '—', true)).toBe(true);
  });

  it('filterEmptyRowsがtrueでも、keywordCountが0でなく経路も判明していれば表示する', () => {
    const { shouldHideSearchResultRow } = loadPureFns();
    expect(shouldHideSearchResultRow({ keywordCount: 2 }, '1. kw', true)).toBe(false);
    expect(shouldHideSearchResultRow({ keywordCount: 1 }, '起点', true)).toBe(false);
  });
});

async function setupHideEmptyRowsTest(hideEmptyRowsDefault?: boolean) {
  const html = buildPage(hideEmptyRowsDefault);
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });

  // a:seed -(k:a)-> a:mid
  const graphNodes = [
    { id: 'a:seed', type: 'answer', label: 'seed', depth: 0 },
    { id: 'k:a', type: 'keyword', label: 'kw-a', depth: 1 },
    { id: 'a:mid', type: 'answer', label: 'mid', depth: 2 },
  ];
  const graphEdges = [
    { from: 'a:seed', to: 'k:a' },
    { from: 'k:a', to: 'a:mid' },
  ];
  const firstSearchResults = [
    { id: 'seed', question: '質問1(起点)', created_at: '2026-01-01T00:00:00.000Z', keywordCount: 1 },
  ];
  const secondSearchResults = [
    { id: 'mid', question: '質問2(グラフ内・キーワードあり)', created_at: '2026-01-02T00:00:00.000Z', keywordCount: 1 },
    { id: 'zero-kw', question: '質問3(キーワード数0)', created_at: '2026-01-03T00:00:00.000Z', keywordCount: 0 },
    { id: 'not-in-graph', question: '質問4(グラフ外=経路ー)', created_at: '2026-01-04T00:00:00.000Z', keywordCount: 2 },
  ];
  let searchCallCount = 0;
  const fetchMock = vi.fn((url: string) => {
    const u = String(url);
    if (u.includes('/api/aichat/shares/search')) {
      searchCallCount++;
      const results = searchCallCount === 1 ? firstSearchResults : secondSearchResults;
      return Promise.resolve({ json: () => Promise.resolve({ results }) });
    }
    if (u.includes('/api/aichat/answer-propagation-graph')) {
      return Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify({ nodes: graphNodes, edges: graphEdges })) });
    }
    return Promise.resolve({ json: () => Promise.resolve({}) });
  });
  vi.stubGlobal('fetch', fetchMock);

  const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();

  await new Promise((resolve) => setTimeout(resolve, 10));

  const seedSearchInput = document.getElementById('seedSearchInput') as HTMLInputElement;
  seedSearchInput.value = 'q';
  seedSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 400));

  return {
    seedSearchInput,
    seedSearchResults: document.getElementById('seedSearchResults')!,
    answerKeywordsBar: document.getElementById('answerKeywordsBar')!,
  };
}

function questionTexts(seedSearchResults: HTMLElement) {
  return Array.from(seedSearchResults.querySelectorAll('.search-result-question')).map((el) => el.textContent);
}

describe('起点検索結果テーブル(DOM実動作): キーワードバーのチップ経由の再検索での空行非表示', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('設定デフォルト(ON)のとき、チップをタップして再検索するとキーワード数0・経路ーの行が表から除外される', async () => {
    const { seedSearchResults, answerKeywordsBar } = await setupHideEmptyRowsTest();
    const seedRow = seedSearchResults.querySelector('.search-result-row') as HTMLElement;
    seedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const chip = answerKeywordsBar.querySelector('.answer-keyword-chip') as HTMLElement;
    chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));

    const questions = questionTexts(seedSearchResults);
    expect(questions).toEqual(['質問2(グラフ内・キーワードあり)']);
  });

  it('設定がOFFのとき、チップ経由で再検索してもキーワード数0・経路ーの行は除外されない', async () => {
    const { seedSearchResults, answerKeywordsBar } = await setupHideEmptyRowsTest(false);
    const seedRow = seedSearchResults.querySelector('.search-result-row') as HTMLElement;
    seedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const chip = answerKeywordsBar.querySelector('.answer-keyword-chip') as HTMLElement;
    chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));

    const questions = questionTexts(seedSearchResults);
    expect(questions).toEqual([
      '質問4(グラフ外=経路ー)',
      '質問3(キーワード数0)',
      '質問2(グラフ内・キーワードあり)',
    ]);
  });

  it('チップ経由で絞り込んだあと、検索窓へ手入力で検索すると絞り込みは解除される', async () => {
    const { seedSearchResults, answerKeywordsBar, seedSearchInput } = await setupHideEmptyRowsTest();
    const seedRow = seedSearchResults.querySelector('.search-result-row') as HTMLElement;
    seedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const chip = answerKeywordsBar.querySelector('.answer-keyword-chip') as HTMLElement;
    chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(questionTexts(seedSearchResults)).toEqual(['質問2(グラフ内・キーワードあり)']);

    seedSearchInput.value = 'q2';
    seedSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(questionTexts(seedSearchResults)).toEqual([
      '質問4(グラフ外=経路ー)',
      '質問3(キーワード数0)',
      '質問2(グラフ内・キーワードあり)',
    ]);
  });
});
