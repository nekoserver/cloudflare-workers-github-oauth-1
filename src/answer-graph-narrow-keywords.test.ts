// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページ(src/views/answerGraph.ts)の🧭「キーワードで絞り込む」
// モーダル。起点検索結果から最終的に適切な質問を選ぶまでの繰り返し絞り込みを
// 支援する。手順:
//   1. 経路が「ー」(=ロード済みグラフにまだ含まれない)行は除外する
//   2. 残った各行(質問)の回答文に含まれるキーワードを全て集めて重複削除する
//   3. 各キーワードのAIチャットページでの出現回数を取得し、多い順に並べて
//      最上位レイヤーのモーダルに列挙し、ユーザーに選択させる
// キーワードを選ぶとそれで再検索し、モーダルを開いたままなら1.→3.を
// 繰り返す。ユーザーが検索結果テーブルから実際に質問行を選ぶまで続く。
//
// 故障シナリオ:
//   (1) グラフにまだ含まれない(経路が「ー」の)行の回答文からもキーワードを
//       集めてしまう
//   (2) 同じキーワードが重複して列挙される
//   (3) 出現回数の多い順に並んでいない
//   (4) モーダルでキーワードを選んでも再検索されない、またはモーダルが
//       開いたままなのに候補が更新されない
//   (5) グラフが未ロードの状態でモーダルを開くとエラーで落ちる

function buildPage(): string {
  return getAnswerGraphPage('testuser', {});
}

function loadPureFns() {
  const html = buildPage();
  const idx = html.indexOf('function computeRadialLayout');
  const endIdx = html.indexOf('function drawGraph');
  expect(idx).toBeGreaterThan(-1);
  expect(endIdx).toBeGreaterThan(idx);
  const src = html.slice(idx, endIdx);
  const fn = new Function(`${src}\nreturn { computeNarrowingKeywordCandidates: computeNarrowingKeywordCandidates, computeRadialLayout: computeRadialLayout };`);
  return fn() as {
    computeNarrowingKeywordCandidates: (
      rows: Array<{ id: string }>,
      posById: Record<string, { x: number; y: number; node: unknown }>,
      cx: number,
      cy: number,
      edges: Array<{ from: string; to: string }>,
      keywordCountMap: Record<string, number>,
    ) => Array<{ keyword: string; count: number }>;
    computeRadialLayout: (nodes: unknown[], ringSpacing: number) => { cx: number; cy: number; posById: Record<string, { x: number; y: number; node: unknown }> };
  };
}

describe('computeNarrowingKeywordCandidates: 検索結果から絞り込みキーワード候補を求める', () => {
  // a:seed -(k:a)-> a:mid -(k:x,k:y)-> a:end
  const nodes = [
    { id: 'a:seed', type: 'answer', label: 'seed', depth: 0 },
    { id: 'k:a', type: 'keyword', label: 'kw-a', depth: 1 },
    { id: 'a:mid', type: 'answer', label: 'mid', depth: 2 },
    { id: 'k:x', type: 'keyword', label: 'kw-x', depth: 3 },
    { id: 'k:y', type: 'keyword', label: 'kw-y', depth: 3 },
    { id: 'a:end', type: 'answer', label: 'end', depth: 4 },
  ];
  const edges = [
    { from: 'a:seed', to: 'k:a' },
    { from: 'k:a', to: 'a:mid' },
    { from: 'a:mid', to: 'k:x' },
    { from: 'a:mid', to: 'k:y' },
    { from: 'k:x', to: 'a:end' },
  ];
  const keywordCountMap = { 'kw-a': 3, 'kw-x': 50, 'kw-y': 10 };

  it('ロード済みグラフに含まれない(経路が「ー」の)行は除外し、その回答文のキーワードを集めない', () => {
    const { computeRadialLayout, computeNarrowingKeywordCandidates } = loadPureFns();
    const layout = computeRadialLayout(nodes, 80);
    const rows = [{ id: 'seed' }, { id: 'mid' }, { id: 'not-in-graph' }];
    const candidates = computeNarrowingKeywordCandidates(rows, layout.posById, layout.cx, layout.cy, edges, keywordCountMap);
    const keywords = candidates.map((c) => c.keyword);
    expect(keywords).toContain('kw-a');
    expect(keywords).not.toContain('kw-x');
    expect(keywords).not.toContain('kw-y');
  });

  it('複数行から同じキーワードが見つかっても重複せず1件になる', () => {
    const { computeRadialLayout, computeNarrowingKeywordCandidates } = loadPureFns();
    const layout = computeRadialLayout(nodes, 80);
    const rows = [{ id: 'seed' }, { id: 'mid' }];
    const candidates = computeNarrowingKeywordCandidates(rows, layout.posById, layout.cx, layout.cy, edges, keywordCountMap);
    const kwACount = candidates.filter((c) => c.keyword === 'kw-a').length;
    expect(kwACount).toBe(1);
  });

  it('AIチャットページでの出現回数(keywordCountMap)の多い順に並ぶ', () => {
    const { computeRadialLayout, computeNarrowingKeywordCandidates } = loadPureFns();
    const layout = computeRadialLayout(nodes, 80);
    const rows = [{ id: 'seed' }, { id: 'mid' }, { id: 'end' }];
    const candidates = computeNarrowingKeywordCandidates(rows, layout.posById, layout.cx, layout.cy, edges, keywordCountMap);
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i].count).toBeLessThanOrEqual(candidates[i - 1].count);
    }
    expect(candidates[0].keyword).toBe('kw-x');
  });

  it('keywordCountMapに無いキーワードは出現回数0として扱う', () => {
    const { computeRadialLayout, computeNarrowingKeywordCandidates } = loadPureFns();
    const layout = computeRadialLayout(nodes, 80);
    const rows = [{ id: 'seed' }];
    const candidates = computeNarrowingKeywordCandidates(rows, layout.posById, layout.cx, layout.cy, edges, {});
    expect(candidates).toEqual([{ keyword: 'kw-a', count: 0 }]);
  });
});

async function setupNarrowModalTest() {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });

  // a:seed -(k:a)-> a:mid -(k:x)-> a:end
  const graphNodes = [
    { id: 'a:seed', type: 'answer', label: 'seed', depth: 0 },
    { id: 'k:a', type: 'keyword', label: 'kw-a', depth: 1 },
    { id: 'a:mid', type: 'answer', label: 'mid', depth: 2 },
    { id: 'k:x', type: 'keyword', label: 'kw-x', depth: 3 },
    { id: 'a:end', type: 'answer', label: 'end', depth: 4 },
  ];
  const graphEdges = [
    { from: 'a:seed', to: 'k:a' },
    { from: 'k:a', to: 'a:mid' },
    { from: 'a:mid', to: 'k:x' },
    { from: 'k:x', to: 'a:end' },
  ];
  const firstSearchResults = [
    { id: 'seed', question: '質問1(起点)', created_at: '2026-01-01T00:00:00.000Z', keywordCount: 1 },
    { id: 'mid', question: '質問2(グラフ内)', created_at: '2026-01-02T00:00:00.000Z', keywordCount: 1 },
    { id: 'not-in-graph', question: '質問3(グラフ外)', created_at: '2026-01-03T00:00:00.000Z', keywordCount: 1 },
  ];
  const secondSearchResults = [
    { id: 'end', question: '質問4(kw-xで再検索した結果)', created_at: '2026-01-04T00:00:00.000Z', keywordCount: 1 },
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
      return Promise.resolve({ json: () => Promise.resolve({ keywords: [{ keyword: 'kw-a', cnt: 2 }] }) });
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
    narrowKeywordsBtn: document.getElementById('narrowKeywordsBtn')!,
    narrowModalBackdrop: document.getElementById('narrowModalBackdrop')!,
    narrowModalBody: document.getElementById('narrowModalBody')!,
    seedSearchResults: document.getElementById('seedSearchResults')!,
  };
}

describe('🧭キーワードで絞り込むモーダル(DOM実動作)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('グラフ未ロードの状態でボタンを押すと、モーダルにその旨のメッセージが表示される', async () => {
    const { narrowKeywordsBtn, narrowModalBackdrop, narrowModalBody } = await setupNarrowModalTest();
    narrowKeywordsBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(narrowModalBackdrop.classList.contains('open')).toBe(true);
    expect(narrowModalBody.textContent).toContain('起点となる質問を選んで');
  });

  it('グラフをロード後にボタンを押すと、経路が判明している行(seed・mid)の回答文キーワードだけが候補になる', async () => {
    const { narrowKeywordsBtn, narrowModalBody, seedSearchResults } = await setupNarrowModalTest();
    const seedRow = Array.from(seedSearchResults.querySelectorAll('.search-result-row'))
      .find((r) => r.querySelector('.search-result-question')!.textContent === '質問1(起点)') as HTMLElement;
    seedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    narrowKeywordsBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const chips = Array.from(narrowModalBody.querySelectorAll('.narrow-modal-chip')).map((c) => c.textContent);
    expect(chips.length).toBe(1);
    expect(chips[0]).toContain('kw-a');
  });

  it('モーダル内のキーワードを選ぶと再検索が実行され、モーダルが開いたままなら候補が更新される(1.→3.の繰り返し)', async () => {
    const { narrowKeywordsBtn, narrowModalBody, seedSearchResults, narrowModalBackdrop } = await setupNarrowModalTest();
    const seedRow = Array.from(seedSearchResults.querySelectorAll('.search-result-row'))
      .find((r) => r.querySelector('.search-result-question')!.textContent === '質問1(起点)') as HTMLElement;
    seedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    narrowKeywordsBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const chip = narrowModalBody.querySelector('.narrow-modal-chip') as HTMLElement;
    chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));

    // モーダルは開いたままで、再検索されたことがわかる(検索窓にキーワードが入る)
    expect(narrowModalBackdrop.classList.contains('open')).toBe(true);
    const seedSearchInput = document.getElementById('seedSearchInput') as HTMLInputElement;
    expect(seedSearchInput.value).toBe('kw-a');
    const questions = Array.from(seedSearchResults.querySelectorAll('.search-result-question')).map((el) => el.textContent);
    expect(questions).toEqual(['質問4(kw-xで再検索した結果)']);
  });

  it('✕ボタンでモーダルを閉じられる', async () => {
    const { narrowKeywordsBtn, narrowModalBackdrop } = await setupNarrowModalTest();
    narrowKeywordsBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(narrowModalBackdrop.classList.contains('open')).toBe(true);
    (document.getElementById('narrowModalClose') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(narrowModalBackdrop.classList.contains('open')).toBe(false);
  });
});
