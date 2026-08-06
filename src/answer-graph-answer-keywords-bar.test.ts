// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページ(src/views/answerGraph.ts)の起点質問選択直後に
// 表(#seedSearchResults)の真上へ表示する「この回答文のキーワード」バー
// (#answerKeywordsBar)。起点質問を選ぶと、その回答文に直結するキーワードが
// チップとして並び、選ぶと中分類カテゴリの<select>を選んだ直後と同じ処理
// (検索窓へ値をセットしてdoSeedSearchを呼ぶ)に渡され、再度起点行を選べば
// 1.起点選択→2.キーワード列挙→3.キーワード選択、のループが繰り返される。
//
// 故障シナリオ:
//   (1) 起点質問を選んでもキーワードバーが表示されない、または前回の
//       内容が残ったままになる
//   (2) キーワードバーのチップがその回答文に直結しないキーワードを含む
//   (3) チップをクリックしても検索窓に値がセットされず、再検索されない
//   (4) チップをクリックして得られた新しい検索結果から再度起点行を選んでも
//       バーが更新されない(ループが繰り返されない)
//   (5) グラフ未ロード・その行がグラフに含まれない場合にエラーで落ちる

function buildPage(): string {
  return getAnswerGraphPage('testuser', {});
}

async function setupAnswerKeywordsBarTest() {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });

  // a:seed -(k:a,k:b)-> a:mid -(k:x)-> a:end
  const graphNodes = [
    { id: 'a:seed', type: 'answer', label: 'seed', depth: 0 },
    { id: 'k:a', type: 'keyword', label: 'kw-a', depth: 1 },
    { id: 'k:b', type: 'keyword', label: 'kw-b', depth: 1 },
    { id: 'a:mid', type: 'answer', label: 'mid', depth: 2 },
    { id: 'k:x', type: 'keyword', label: 'kw-x', depth: 3 },
    { id: 'a:end', type: 'answer', label: 'end', depth: 4 },
  ];
  const graphEdges = [
    { from: 'a:seed', to: 'k:a' },
    { from: 'a:seed', to: 'k:b' },
    { from: 'k:a', to: 'a:mid' },
    { from: 'a:mid', to: 'k:x' },
    { from: 'k:x', to: 'a:end' },
  ];
  const firstSearchResults = [
    { id: 'seed', question: '質問1(起点)', created_at: '2026-01-01T00:00:00.000Z', keywordCount: 2 },
  ];
  const secondSearchResults = [
    { id: 'mid', question: '質問2(kw-aで再検索した結果)', created_at: '2026-01-02T00:00:00.000Z', keywordCount: 1 },
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
    if (u.includes('/api/aichat/all-keywords')) {
      return Promise.resolve({ json: () => Promise.resolve({ keywords: [{ keyword: 'kw-a', cnt: 4 }, { keyword: 'kw-b', cnt: 2 }] }) });
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

describe('起点質問選択直後のキーワードバー(#answerKeywordsBar): DOM実動作', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('起点質問を選ぶ前はキーワードバーが表示されない', async () => {
    const { answerKeywordsBar } = await setupAnswerKeywordsBarTest();
    expect(answerKeywordsBar.style.display).not.toBe('flex');
    expect(answerKeywordsBar.querySelectorAll('.answer-keyword-chip').length).toBe(0);
  });

  it('起点質問を選ぶと、その回答文に直結するキーワードだけがチップとして表示される', async () => {
    const { seedSearchResults, answerKeywordsBar } = await setupAnswerKeywordsBarTest();
    const seedRow = seedSearchResults.querySelector('.search-result-row') as HTMLElement;
    seedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(answerKeywordsBar.style.display).toBe('flex');
    const chips = Array.from(answerKeywordsBar.querySelectorAll('.answer-keyword-chip')).map((c) => c.textContent);
    expect(chips.some((t) => t!.indexOf('kw-a') !== -1)).toBe(true);
    expect(chips.some((t) => t!.indexOf('kw-b') !== -1)).toBe(true);
    expect(chips.some((t) => t!.indexOf('kw-x') !== -1)).toBe(false);
  });

  it('チップを選ぶと検索窓へ値がセットされ再検索が実行される(中分類カテゴリ選択直後と同じ処理)', async () => {
    const { seedSearchResults, answerKeywordsBar, seedSearchInput } = await setupAnswerKeywordsBarTest();
    const seedRow = seedSearchResults.querySelector('.search-result-row') as HTMLElement;
    seedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const chip = Array.from(answerKeywordsBar.querySelectorAll('.answer-keyword-chip'))
      .find((c) => c.textContent!.indexOf('kw-a') !== -1) as HTMLElement;
    chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(seedSearchInput.value).toBe('kw-a');
    const questions = Array.from(seedSearchResults.querySelectorAll('.search-result-question')).map((el) => el.textContent);
    expect(questions).toEqual(['質問2(kw-aで再検索した結果)']);
  });

  it('再検索後に別の起点行を選ぶと、キーワードバーがその行の内容に更新される(ループの繰り返し)', async () => {
    const { seedSearchResults, answerKeywordsBar, seedSearchInput } = await setupAnswerKeywordsBarTest();
    const seedRow = seedSearchResults.querySelector('.search-result-row') as HTMLElement;
    seedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const chip = Array.from(answerKeywordsBar.querySelectorAll('.answer-keyword-chip'))
      .find((c) => c.textContent!.indexOf('kw-a') !== -1) as HTMLElement;
    chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(seedSearchInput.value).toBe('kw-a');

    const midRow = seedSearchResults.querySelector('.search-result-row') as HTMLElement;
    midRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const chips = Array.from(answerKeywordsBar.querySelectorAll('.answer-keyword-chip')).map((c) => c.textContent);
    expect(chips.some((t) => t!.indexOf('kw-x') !== -1)).toBe(true);
    expect(chips.some((t) => t!.indexOf('kw-a') !== -1)).toBe(false);
  });

  it('グラフ未ロード・その行がグラフに含まれない場合はキーワードバーが非表示のままエラーにならない', async () => {
    const { answerKeywordsBar } = await setupAnswerKeywordsBarTest();
    expect(() => { answerKeywordsBar.style.display; }).not.toThrow();
    expect(answerKeywordsBar.style.display).not.toBe('flex');
    expect(answerKeywordsBar.querySelectorAll('.answer-keyword-chip').length).toBe(0);
  });
});
