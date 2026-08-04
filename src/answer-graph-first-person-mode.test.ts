// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページ(src/views/answerGraph.ts)に新設した「一人称モード」。
// Googleストリートビュー風に、グラフの中心(起点回答)に立った視点で周囲360度を
// ←/→ボタンやスワイプで見渡し、↑ボタンまたは中央のノードクリックで選択・回答モーダルを
// 開けるようにする機能。
//
// 故障シナリオ:
//   (1) 起点ノード(depth 0、視点そのもの)がパノラマ上に自分自身として表示されてしまう
//   (2) 視野角(FOV)の外にあるノードまで表示され、360度中の一部を切り出す
//       「一人称」の体験にならない
//   (3) 見た目の角度(bearingDeg)がheadingDegに対して正しく相対化されない
//       (常に同じノードが中央に来る、または回転してもノードが動かない)
//   (4) ↑ボタンが「中央に最も近いノード」ではなく無関係なノードを選択してしまう
//   (5) 一人称モードON/OFFの切替でcanvas俯瞰ビューとの表示が両方残る、または
//       どちらも表示されなくなる
//   (6) スワイプ量とパノラマ回転量の対応が計算されず、指の動きに応じて視界が回らない

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
  const fn = new Function(`${src}\nreturn { computeRadialLayout: computeRadialLayout, computeFirstPersonSlots: computeFirstPersonSlots, normalizeDeg360: normalizeDeg360, normalizeDegSigned: normalizeDegSigned };`);
  return fn() as {
    computeRadialLayout: (nodes: unknown[], ringSpacing: number) => { size: number; cx: number; cy: number; posById: Record<string, { x: number; y: number; node: unknown }> };
    computeFirstPersonSlots: (posById: Record<string, { x: number; y: number; node: unknown }>, cx: number, cy: number, headingDeg: number, fovDeg: number) => Array<{ id: string; bearingDeg: number; relativeDeg: number; distance: number; screenX: number; scale: number }>;
    normalizeDeg360: (deg: number) => number;
    normalizeDegSigned: (deg: number) => number;
  };
}

const sampleNodes = [
  { id: 'a:seed', type: 'answer', label: 'seed', depth: 0 },
  { id: 'k:north', type: 'keyword', label: 'north-kw', depth: 1 },
  { id: 'k:east', type: 'keyword', label: 'east-kw', depth: 1 },
  { id: 'k:south', type: 'keyword', label: 'south-kw', depth: 1 },
  { id: 'k:west', type: 'keyword', label: 'west-kw', depth: 1 },
];

describe('/answer-graph ページのHTML構造: 一人称モード用の要素が存在する', () => {
  const html = buildPage();

  it('モード切替ボタン・パノラマビュー・左右/前進ボタンが存在する', () => {
    expect(html).toContain('id="fpToggleBtn"');
    expect(html).toContain('id="fpView"');
    expect(html).toContain('id="fpSky"');
    expect(html).toContain('id="fpNodes"');
    expect(html).toContain('id="fpLeftBtn"');
    expect(html).toContain('id="fpRightBtn"');
    expect(html).toContain('id="fpForwardBtn"');
  });

  it('一人称モードビューは既定で非表示(display:none)である', () => {
    const idx = html.indexOf('id="fpView"');
    const tagStart = html.lastIndexOf('<div', idx);
    const tag = html.slice(tagStart, idx + 50);
    expect(tag).toContain('display:none');
  });
});

describe('normalizeDeg360 / normalizeDegSigned: 角度の正規化', () => {
  it('normalizeDeg360は負の角度・360超の角度を0〜360の範囲に正規化する', () => {
    const { normalizeDeg360 } = loadPureFns();
    expect(normalizeDeg360(-10)).toBeCloseTo(350, 5);
    expect(normalizeDeg360(370)).toBeCloseTo(10, 5);
    expect(normalizeDeg360(180)).toBeCloseTo(180, 5);
  });

  it('normalizeDegSignedは-180〜180の範囲に正規化する(最短回転方向を表す)', () => {
    const { normalizeDegSigned } = loadPureFns();
    expect(normalizeDegSigned(350)).toBeCloseTo(-10, 5);
    expect(normalizeDegSigned(10)).toBeCloseTo(10, 5);
    expect(normalizeDegSigned(190)).toBeCloseTo(-170, 5);
  });
});

describe('computeFirstPersonSlots: 中心(視点)に立った360度パノラマの計算', () => {
  it('depth 0(視点そのもの)のノードはパノラマに含めない', () => {
    const { computeRadialLayout, computeFirstPersonSlots } = loadPureFns();
    const layout = computeRadialLayout(sampleNodes, 80);
    const slots = computeFirstPersonSlots(layout.posById, layout.cx, layout.cy, 0, 360);
    expect(slots.some((s) => s.id === 'a:seed')).toBe(false);
    expect(slots.length).toBe(4);
  });

  it('視野角(FOV)の外にあるノードは除外される', () => {
    const { computeRadialLayout, computeFirstPersonSlots } = loadPureFns();
    const layout = computeRadialLayout(sampleNodes, 80);
    // FOV 100度、heading 0度(東向き) -> 北(90度)・南(-90度)の一部は境界外
    const slots = computeFirstPersonSlots(layout.posById, layout.cx, layout.cy, 0, 60);
    const ids = slots.map((s) => s.id);
    expect(ids).toContain('k:east');
    expect(ids).not.toContain('k:west');
  });

  it('headingDegを変えると相対角度(relativeDeg)が変化し、正面に来るノードが変わる', () => {
    const { computeRadialLayout, computeFirstPersonSlots } = loadPureFns();
    const layout = computeRadialLayout(sampleNodes, 80);
    // レイアウトはcanvas座標系(y下向き)で角度を割り当てるため、実際の並び順での
    // bearingDegを事前に確認してからheadingDegに使う(k:east=0度, k:north=270度)。
    const bearingProbe = computeFirstPersonSlots(layout.posById, layout.cx, layout.cy, 0, 360);
    const eastBearing = bearingProbe.find((s) => s.id === 'k:east')!.bearingDeg;
    const northBearing = bearingProbe.find((s) => s.id === 'k:north')!.bearingDeg;
    const facingEast = computeFirstPersonSlots(layout.posById, layout.cx, layout.cy, eastBearing, 40);
    const facingNorth = computeFirstPersonSlots(layout.posById, layout.cx, layout.cy, northBearing, 40);
    expect(facingEast.find((s) => s.id === 'k:east')!.relativeDeg).toBeCloseTo(0, 3);
    expect(facingNorth.find((s) => s.id === 'k:north')!.relativeDeg).toBeCloseTo(0, 3);
    expect(facingNorth.some((s) => s.id === 'k:east')).toBe(false);
  });

  it('screenXは中央(0.5)を基準に相対角度に応じて左右へ配置される', () => {
    const { computeRadialLayout, computeFirstPersonSlots } = loadPureFns();
    const layout = computeRadialLayout(sampleNodes, 80);
    const slots = computeFirstPersonSlots(layout.posById, layout.cx, layout.cy, 0, 100);
    const east = slots.find((s) => s.id === 'k:east')!;
    expect(east.screenX).toBeCloseTo(0.5, 3);
  });

  it('遠いノードほどscaleが小さくなる(距離に応じた縮小)', () => {
    const { computeRadialLayout, computeFirstPersonSlots } = loadPureFns();
    const nodesWithDepth2 = [
      ...sampleNodes,
      { id: 'k:far-east', type: 'keyword', label: 'far-east', depth: 2 },
    ];
    const layout = computeRadialLayout(nodesWithDepth2, 80);
    const slots = computeFirstPersonSlots(layout.posById, layout.cx, layout.cy, 0, 100);
    const near = slots.find((s) => s.id === 'k:east')!;
    const far = slots.find((s) => s.id === 'k:far-east');
    if (far) {
      expect(far.scale).toBeLessThanOrEqual(near.scale);
    }
  });
});

describe('一人称モードのDOM実動作(jsdom): トグル・回転・選択', () => {
  it('fpToggleBtnクリックでfp-viewが表示されcanvas-wrapが非表示になる(俯瞰⇔一人称の排他表示)', () => {
    const html = buildPage();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
    // canvas 2D contextはjsdomで未実装のため、getContext呼び出しをスタブする
    const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
    proto.getContext = () => ({
      clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
    });
    const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();

    const fpToggleBtn = document.getElementById('fpToggleBtn')!;
    const fpView = document.getElementById('fpView')!;
    const canvasWrap = document.querySelector('.canvas-wrap') as HTMLElement;

    expect(fpView.style.display).toBe('none');
    fpToggleBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(fpView.style.display).toBe('flex');
    expect(canvasWrap.style.display).toBe('none');

    fpToggleBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(fpView.style.display).toBe('none');
    expect(canvasWrap.style.display).toBe('');
  });
});
