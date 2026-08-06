// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページ(src/views/answerGraph.ts)の俯瞰グラフビュー
// (drawGraph)。回答文ノードの円の直径を、含まれているキーワード数が
// 多いほど大きく(オアシス)、少ないほど小さく(砂漠)描画し、さらに奥
// (depthが大きい)ほど遠近感で小さくする。
//
// 故障シナリオ:
//   (1) キーワード数が多い回答ノードでも円の大きさが変わらない
//   (2) depthが大きい(奥にある)ノードでも手前と同じ大きさのまま描画され、
//       遠近感が出ない
//   (3) キーワード数がゼロの回答ノードで半径が0以下・NaN等の不正な値になる
//   (4) depthが大きくなるにつれて半径が際限なく縮み、0以下になる

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
  const fn = new Function(`${src}\nreturn { computeAnswerNodeRadius: computeAnswerNodeRadius, countAnswerKeywordDegree: countAnswerKeywordDegree, computeKeywordNodeRadius: computeKeywordNodeRadius, computeRadialLayout: computeRadialLayout };`);
  return fn() as {
    computeAnswerNodeRadius: (keywordCount: number, depth: number) => number;
    countAnswerKeywordDegree: (posById: Record<string, { x: number; y: number; node: unknown }>, edges: Array<{ from: string; to: string }>, answerId: string) => number;
    computeKeywordNodeRadius: (occurrenceCount: number) => number;
    computeRadialLayout: (nodes: unknown[], ringSpacing: number) => { posById: Record<string, { x: number; y: number; node: unknown }> };
  };
}

describe('computeAnswerNodeRadius: 回答文ノードの円の直径(キーワード数×奥行き)', () => {
  it('キーワード数が多いほど半径が大きくなる(同じdepthで比較)', () => {
    const { computeAnswerNodeRadius } = loadPureFns();
    const r0 = computeAnswerNodeRadius(0, 0);
    const r5 = computeAnswerNodeRadius(5, 0);
    const r20 = computeAnswerNodeRadius(20, 0);
    expect(r5).toBeGreaterThan(r0);
    expect(r20).toBeGreaterThan(r5);
  });

  it('同じキーワード数でも奥(depthが大きい)ほど半径が小さくなる', () => {
    const { computeAnswerNodeRadius } = loadPureFns();
    const near = computeAnswerNodeRadius(5, 0);
    const mid = computeAnswerNodeRadius(5, 3);
    const far = computeAnswerNodeRadius(5, 8);
    expect(mid).toBeLessThan(near);
    expect(far).toBeLessThan(mid);
  });

  it('キーワード数0・depth0でも半径は正の値になる(円が消えない)', () => {
    const { computeAnswerNodeRadius } = loadPureFns();
    expect(computeAnswerNodeRadius(0, 0)).toBeGreaterThan(0);
  });

  it('depthがどれだけ大きくても半径は0以下にならない(下限でクランプされる)', () => {
    const { computeAnswerNodeRadius } = loadPureFns();
    expect(computeAnswerNodeRadius(5, 100)).toBeGreaterThan(0);
    expect(computeAnswerNodeRadius(0, 100)).toBeGreaterThan(0);
  });

  it('キーワード数がどれだけ多くても半径は際限なく大きくならない(上限でクランプされる)', () => {
    const { computeAnswerNodeRadius } = loadPureFns();
    const r100 = computeAnswerNodeRadius(100, 0);
    const r1000 = computeAnswerNodeRadius(1000, 0);
    expect(r1000).toBe(r100);
  });
});

describe('computeKeywordNodeRadius: キーワードノードの円の直径(AIチャットページでの出現回数に比例)', () => {
  it('出現回数が多いほど半径が大きくなる', () => {
    const { computeKeywordNodeRadius } = loadPureFns();
    const r0 = computeKeywordNodeRadius(0);
    const r5 = computeKeywordNodeRadius(5);
    const r20 = computeKeywordNodeRadius(20);
    expect(r5).toBeGreaterThan(r0);
    expect(r20).toBeGreaterThan(r5);
  });

  it('出現回数0・未指定(undefined)でも半径は正の値になる(円が消えない)', () => {
    const { computeKeywordNodeRadius } = loadPureFns();
    expect(computeKeywordNodeRadius(0)).toBeGreaterThan(0);
    expect(computeKeywordNodeRadius(undefined as unknown as number)).toBeGreaterThan(0);
  });

  it('出現回数がどれだけ多くても半径は際限なく大きくならない(上限でクランプされる)', () => {
    const { computeKeywordNodeRadius } = loadPureFns();
    const r100 = computeKeywordNodeRadius(100);
    const r1000 = computeKeywordNodeRadius(1000);
    expect(r1000).toBe(r100);
  });
});

describe('countAnswerKeywordDegree: 回答文ノードに直結するキーワード数の集計', () => {
  const nodes = [
    { id: 'a:seed', type: 'answer', label: 'seed', depth: 0 },
    { id: 'k:a', type: 'keyword', label: 'kw-a', depth: 1 },
    { id: 'k:b', type: 'keyword', label: 'kw-b', depth: 1 },
    { id: 'a:child', type: 'answer', label: 'child', depth: 2 },
  ];
  const edges = [
    { from: 'a:seed', to: 'k:a' },
    { from: 'a:seed', to: 'k:b' },
    { from: 'k:a', to: 'a:child' },
  ];

  it('直結するキーワードノードだけを数える(回答ノードは数えない)', () => {
    const { computeRadialLayout, countAnswerKeywordDegree } = loadPureFns();
    const layout = computeRadialLayout(nodes, 80);
    expect(countAnswerKeywordDegree(layout.posById, edges, 'a:seed')).toBe(2);
    expect(countAnswerKeywordDegree(layout.posById, edges, 'a:child')).toBe(1);
  });

  it('辺が無いノードは0を返す', () => {
    const { computeRadialLayout, countAnswerKeywordDegree } = loadPureFns();
    const layout = computeRadialLayout(nodes, 80);
    expect(countAnswerKeywordDegree(layout.posById, [], 'a:seed')).toBe(0);
  });

  it('同じ相手ノードへの重複した辺は1件として数える', () => {
    const { computeRadialLayout, countAnswerKeywordDegree } = loadPureFns();
    const layout = computeRadialLayout(nodes, 80);
    const dupEdges = [...edges, { from: 'a:seed', to: 'k:a' }];
    expect(countAnswerKeywordDegree(layout.posById, dupEdges, 'a:seed')).toBe(2);
  });
});

describe('俯瞰グラフビュー(DOM実動作): キーワードノードの円がAIチャットページでの出現回数(/api/aichat/all-keywords)を反映する', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  function makeRecordingCtx() {
    const arcs: Array<{ r: number }> = [];
    const ctx: Record<string, unknown> = {
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      fill: () => {},
      stroke: () => {},
      arc: (_x: number, _y: number, r: number) => { arcs.push({ r }); },
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    };
    return { ctx, arcs };
  }

  it('出現回数が多いキーワードほど円の半径(arc呼び出しのr引数)が大きい', async () => {
    const html = buildPage();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
    const { ctx, arcs } = makeRecordingCtx();
    const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
    proto.getContext = () => ctx;

    const graphNodes = [
      { id: 'a:seed', type: 'answer', label: 'seed', depth: 0 },
      { id: 'k:popular', type: 'keyword', label: 'popular-kw', depth: 1 },
      { id: 'k:rare', type: 'keyword', label: 'rare-kw', depth: 1 },
    ];
    const graphEdges = [
      { from: 'a:seed', to: 'k:popular' },
      { from: 'a:seed', to: 'k:rare' },
    ];
    const fetchMock = vi.fn((url: string) => {
      const u = String(url);
      if (u.includes('/api/aichat/shares/search')) {
        return Promise.resolve({ json: () => Promise.resolve({ results: [{ id: 'share1', question: 'q1', keywordCount: 1 }] }) });
      }
      if (u.includes('/api/aichat/answer-propagation-graph')) {
        return Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify({ nodes: graphNodes, edges: graphEdges })) });
      }
      if (u.includes('/api/aichat/all-keywords')) {
        return Promise.resolve({ json: () => Promise.resolve({ keywords: [
          { keyword: 'popular-kw', cnt: 20 },
          { keyword: 'rare-kw', cnt: 1 },
        ] }) });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();

    // loadCatQuickNav()の/api/aichat/all-keywords取得(ページ初期化時に自動発火)を待つ
    await new Promise((resolve) => setTimeout(resolve, 10));

    const seedSearchInput = document.getElementById('seedSearchInput') as HTMLInputElement;
    seedSearchInput.value = 'q';
    seedSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));

    const resultItem = document.querySelector('.search-result-row') as HTMLElement;
    resultItem.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    // drawGraphはグラフ読み込み時・keywordCountMap取得完了時などに複数回
    // 呼ばれ得るが、ノード描画ループは常にposById(挿入順: seed→popular→rare)
    // の順でarcを呼ぶため、直近3件(最後のdrawGraph呼び出し分)を見れば
    // 最終的に反映された半径を確認できる。
    const [seedR, popularR, rareR] = arcs.slice(-3).map((a) => a.r);
    expect(popularR).toBeGreaterThan(rareR);
    expect(seedR).toBeGreaterThan(0);
  });
});
