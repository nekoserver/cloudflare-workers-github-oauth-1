// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
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
  const fn = new Function(`${src}\nreturn { computeAnswerNodeRadius: computeAnswerNodeRadius, countAnswerKeywordDegree: countAnswerKeywordDegree, computeRadialLayout: computeRadialLayout };`);
  return fn() as {
    computeAnswerNodeRadius: (keywordCount: number, depth: number) => number;
    countAnswerKeywordDegree: (posById: Record<string, { x: number; y: number; node: unknown }>, edges: Array<{ from: string; to: string }>, answerId: string) => number;
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
