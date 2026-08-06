// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページ(src/views/answerGraph.ts)の起点検索結果テーブル
// に新設した「経路」列。ロード済みのグラフ(currentGraph)内で、起点(depth 0)
// からその質問文まで、何段階のキーワード選択を経て到達するかを段階ごとに
// 表示する(computeAnswerPathStages)。ある段階で同じ回答へ複数のキーワード
// から辿り着ける場合は、その段階の候補として全て列挙する。
//
// 故障シナリオ:
//   (1) 深さ4(2段階)以上のノードで、途中の段階が省略される、または
//       段階の順序が起点→末端の順になっていない
//   (2) 同じ段階で複数のキーワードから到達可能な回答なのに、1つしか
//       列挙されない
//   (3) 起点(depth 0)自身の経路表示が「経路なし」等になり、そこが
//       起点であることが分からない
//   (4) グラフがまだロードされていない、またはその行がロード済みの
//       グラフに含まれていない場合にエラーで落ちる、または誤った経路が
//       表示される
//   (5) 検索結果テーブルの列の並び順(🔑→質問日時→経路→質問)が崩れる

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
  const fn = new Function(`${src}\nreturn { computeAnswerPathStages: computeAnswerPathStages, computeRadialLayout: computeRadialLayout };`);
  return fn() as {
    computeAnswerPathStages: (posById: Record<string, { x: number; y: number; node: unknown }>, edges: Array<{ from: string; to: string }>, answerNode: { id: string; depth: number }) => Array<{ depth: number; keywords: string[] }>;
    computeRadialLayout: (nodes: unknown[], ringSpacing: number) => { posById: Record<string, { x: number; y: number; node: unknown }> };
  };
}

describe('computeAnswerPathStages: 起点から質問文まで何段階のキーワードを経て到達するか', () => {
  // a:seed -(k:a,k:b)-> a:mid -(k:x)-> a:end
  const nodes = [
    { id: 'a:seed', type: 'answer', label: 'seed', depth: 0 },
    { id: 'k:a', type: 'keyword', label: 'kw-a', depth: 1 },
    { id: 'k:b', type: 'keyword', label: 'kw-b', depth: 1 },
    { id: 'a:mid', type: 'answer', label: 'mid', depth: 2 },
    { id: 'k:x', type: 'keyword', label: 'kw-x', depth: 3 },
    { id: 'a:end', type: 'answer', label: 'end', depth: 4 },
  ];
  const edges = [
    { from: 'a:seed', to: 'k:a' },
    { from: 'a:seed', to: 'k:b' },
    { from: 'k:a', to: 'a:mid' },
    { from: 'k:b', to: 'a:mid' },
    { from: 'a:mid', to: 'k:x' },
    { from: 'k:x', to: 'a:end' },
  ];

  it('起点(depth 0)自身は空配列(経路なし=そこが起点)を返す', () => {
    const { computeRadialLayout, computeAnswerPathStages } = loadPureFns();
    const layout = computeRadialLayout(nodes, 80);
    const seed = layout.posById['a:seed'].node as { id: string; depth: number };
    expect(computeAnswerPathStages(layout.posById, edges, seed)).toEqual([]);
  });

  it('depth 2の回答(a:mid)は1段階で、その段階に複数のキーワード(kw-a・kw-b)が列挙される', () => {
    const { computeRadialLayout, computeAnswerPathStages } = loadPureFns();
    const layout = computeRadialLayout(nodes, 80);
    const mid = layout.posById['a:mid'].node as { id: string; depth: number };
    const stages = computeAnswerPathStages(layout.posById, edges, mid);
    expect(stages.length).toBe(1);
    expect(stages[0].depth).toBe(1);
    expect(stages[0].keywords.slice().sort()).toEqual(['kw-a', 'kw-b']);
  });

  it('depth 4の回答(a:end)は2段階になり、起点側(depth1)→末端側(depth3)の順に並ぶ', () => {
    const { computeRadialLayout, computeAnswerPathStages } = loadPureFns();
    const layout = computeRadialLayout(nodes, 80);
    const end = layout.posById['a:end'].node as { id: string; depth: number };
    const stages = computeAnswerPathStages(layout.posById, edges, end);
    expect(stages.length).toBe(2);
    expect(stages[0].depth).toBe(1);
    expect(stages[0].keywords.slice().sort()).toEqual(['kw-a', 'kw-b']);
    expect(stages[1].depth).toBe(3);
    expect(stages[1].keywords).toEqual(['kw-x']);
  });
});

async function setupSearchResultPathTest() {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });

  const graphNodes = [
    { id: 'a:seed', type: 'answer', label: 'seed', depth: 0 },
    { id: 'k:a', type: 'keyword', label: 'kw-a', depth: 1 },
    { id: 'a:mid', type: 'answer', label: 'mid', depth: 2 },
  ];
  const graphEdges = [
    { from: 'a:seed', to: 'k:a' },
    { from: 'k:a', to: 'a:mid' },
  ];
  const searchResults = [
    { id: 'seed', question: '質問1(起点)', created_at: '2026-01-01T00:00:00.000Z', keywordCount: 1 },
    { id: 'mid', question: '質問2(グラフ内)', created_at: '2026-01-02T00:00:00.000Z', keywordCount: 1 },
    { id: 'unrelated', question: '質問3(グラフ外)', created_at: '2026-01-03T00:00:00.000Z', keywordCount: 1 },
  ];
  const fetchMock = vi.fn((url: string) => {
    const u = String(url);
    if (u.includes('/api/aichat/shares/search')) {
      return Promise.resolve({ json: () => Promise.resolve({ results: searchResults }) });
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

  const seedSearchInput = document.getElementById('seedSearchInput') as HTMLInputElement;
  seedSearchInput.value = 'q';
  seedSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 400));

  return { seedSearchResults: document.getElementById('seedSearchResults')! };
}

function pathTextFor(seedSearchResults: HTMLElement, questionText: string) {
  const rows = Array.from(seedSearchResults.querySelectorAll('.search-result-row'));
  const row = rows.find((r) => r.querySelector('.search-result-question')!.textContent === questionText)!;
  return row.querySelector('.search-result-path')!.textContent;
}

describe('起点検索結果テーブル(DOM実動作): 経路列', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('グラフがまだロードされていない状態では、全行の経路列がダッシュになる', async () => {
    const { seedSearchResults } = await setupSearchResultPathTest();
    expect(pathTextFor(seedSearchResults, '質問1(起点)')).toBe('—');
    expect(pathTextFor(seedSearchResults, '質問2(グラフ内)')).toBe('—');
  });

  it('検索結果行をクリックしてグラフをロードすると、起点行は「起点」、グラフ内の行は段階付きの経路、グラフ外の行はダッシュになる', async () => {
    const { seedSearchResults } = await setupSearchResultPathTest();
    const seedRow = Array.from(seedSearchResults.querySelectorAll('.search-result-row'))
      .find((r) => r.querySelector('.search-result-question')!.textContent === '質問1(起点)') as HTMLElement;
    seedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(pathTextFor(seedSearchResults, '質問1(起点)')).toBe('起点');
    expect(pathTextFor(seedSearchResults, '質問2(グラフ内)')).toBe('1. kw-a');
    expect(pathTextFor(seedSearchResults, '質問3(グラフ外)')).toBe('—');
  });
});
