// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
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
//   (7) 地平線が目線と同じ高さ(50%)のままで奥行きが感じられない
//   (8) 同じ目線の高さにあるノードが距離に関わらず同じ高さに表示され、
//       手前/奥の遠近感が出ない
//   (9) 左右スワイプ/スクロールの粒度が連続回転のままで、キーワードを一つずつ
//       選択する体験にならない
//   (10) 最上段のフィルムストリップに「いちばん手前」ではない(depth違いの)
//        キーワードが混ざる、またはフォーカス中のチップが薄緑色で塗られない
//   (11) フォーカス中のキーワードが画面中央からずれた位置に表示される
//   (12) 左スワイプ/←ボタンで、フォーカスの右隣のキーワードではなく無関係な
//        方向のキーワードにフォーカスが移ってしまう(方向の取り違え)
//   (13) フィルムストリップのチップ間に固定px等の余白が入り、「隣接キーワード間は
//        1pxの余白のみ」という仕様にならない
//   (14) フォーカス中のキーワードを含まない回答がリストに混ざる、または
//        含む回答が漏れる(エッジの向き(from/to)の一方しか見ていない等)
//   (15) 回答リストの各行に分類色のドットが表示されない、またはドットが
//        行頭ではなく行末など違う位置にある

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
  const fn = new Function(`${src}\nreturn { computeRadialLayout: computeRadialLayout, computeFirstPersonSlots: computeFirstPersonSlots, computeNearestKeywordSlots: computeNearestKeywordSlots, computeFilmstripOffsets: computeFilmstripOffsets, computeAnswersForKeyword: computeAnswersForKeyword, normalizeDeg360: normalizeDeg360, normalizeDegSigned: normalizeDegSigned };`);
  return fn() as {
    computeRadialLayout: (nodes: unknown[], ringSpacing: number) => { size: number; cx: number; cy: number; posById: Record<string, { x: number; y: number; node: unknown }> };
    computeFirstPersonSlots: (posById: Record<string, { x: number; y: number; node: unknown }>, cx: number, cy: number, headingDeg: number, fovDeg: number, horizonPercent?: number, groundPercent?: number) => Array<{ id: string; bearingDeg: number; relativeDeg: number; distance: number; screenX: number; scale: number; topPercent: number }>;
    computeNearestKeywordSlots: (posById: Record<string, { x: number; y: number; node: unknown }>, cx: number, cy: number) => Array<{ id: string; bearingDeg: number; node: { id: string; label: string; depth: number } }>;
    computeFilmstripOffsets: (widths: number[], focusIdx: number, gapPx?: number) => number[];
    computeAnswersForKeyword: (keywordId: string, posById: Record<string, { x: number; y: number; node: unknown }>, edges: Array<{ from: string; to: string }>) => Array<{ id: string; label: string }>;
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

  it('フィルムストリップ(id="fpFilmstrip")が.fp-sky内に存在する', () => {
    expect(html).toContain('id="fpFilmstrip"');
    const skyIdx = html.indexOf('id="fpSky"');
    const filmstripIdx = html.indexOf('id="fpFilmstrip"');
    const skyCloseIdx = html.indexOf('</div>', html.indexOf('id="fpNodes"'));
    expect(filmstripIdx).toBeGreaterThan(skyIdx);
    expect(filmstripIdx).toBeLessThan(skyCloseIdx);
  });

  it('フォーカス中チップ(.fp-film-chip-focused)は薄緑系のCSS変数(--fp-focus-bg等)で塗られ、固定色をハードコードしない', () => {
    const ruleIdx = html.indexOf('.fp-film-chip.fp-film-chip-focused');
    const rule = html.slice(ruleIdx, html.indexOf('}', ruleIdx));
    expect(rule).toContain('var(--fp-focus-bg)');
    expect(rule).toContain('var(--fp-focus-border)');
    expect(rule).not.toMatch(/background:\s*#/);
  });

  it('--fp-focus-bg等はライト/ダーク両方の@mediaブロックで定義されている', () => {
    const lightBlock = html.slice(html.indexOf('prefers-color-scheme:light'), html.indexOf('prefers-color-scheme:dark'));
    const darkBlockIdx = html.indexOf('prefers-color-scheme:dark');
    const darkBlock = html.slice(darkBlockIdx, html.indexOf('}', darkBlockIdx) + 1);
    expect(lightBlock).toContain('--fp-focus-bg');
    expect(darkBlock).toContain('--fp-focus-bg');
  });

  it('一人称モードビューは既定で非表示(display:none)である', () => {
    const idx = html.indexOf('id="fpView"');
    const tagStart = html.lastIndexOf('<div', idx);
    const tag = html.slice(tagStart, idx + 50);
    expect(tag).toContain('display:none');
  });

  it('地平線(.fp-horizon)・視界の的(.fp-crosshair)は目線(50%)より上の高さ(38%)に配置される', () => {
    const horizonRuleIdx = html.indexOf('.fp-horizon');
    const horizonRule = html.slice(horizonRuleIdx, html.indexOf('}', horizonRuleIdx));
    expect(horizonRule).toContain('top:38%');
    expect(horizonRule).not.toContain('top:50%');

    const crosshairRuleIdx = html.indexOf('.fp-crosshair');
    const crosshairRule = html.slice(crosshairRuleIdx, html.indexOf('}', crosshairRuleIdx));
    expect(crosshairRule).toContain('top:38%');
  });

  it('.fp-nodeのCSSは高さ(top)を固定値でハードコードしていない(JSで距離に応じて動的設定するため)', () => {
    const ruleIdx = html.indexOf('.fp-node {');
    const rule = html.slice(ruleIdx, html.indexOf('}', ruleIdx));
    expect(rule).not.toContain('top:50%');
    expect(rule).not.toMatch(/top:\d/);
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

  it('距離に応じて高さ(topPercent)が変化する: 最も近いノードは地面(groundPercent)寄り、最も遠いノードは地平線(horizonPercent)寄りになる', () => {
    const { computeRadialLayout, computeFirstPersonSlots } = loadPureFns();
    const nodes = [
      { id: 'a:seed', type: 'answer', label: 'seed', depth: 0 },
      { id: 'k:near', type: 'keyword', label: 'near', depth: 1 },
      { id: 'k:far', type: 'keyword', label: 'far', depth: 2 },
    ];
    const layout = computeRadialLayout(nodes, 80);
    const slots = computeFirstPersonSlots(layout.posById, layout.cx, layout.cy, 0, 360);
    const near = slots.find((s) => s.id === 'k:near')!;
    const far = slots.find((s) => s.id === 'k:far')!;
    expect(far.topPercent).toBeCloseTo(38, 3);
    expect(near.topPercent).toBeGreaterThan(far.topPercent);
    expect(near.topPercent).toBeLessThanOrEqual(90);
  });

  it('horizonPercent/groundPercentを省略すると既定値(38/90)が使われる', () => {
    const { computeRadialLayout, computeFirstPersonSlots } = loadPureFns();
    const layout = computeRadialLayout(sampleNodes, 80);
    const withDefaults = computeFirstPersonSlots(layout.posById, layout.cx, layout.cy, 0, 360);
    const withExplicit = computeFirstPersonSlots(layout.posById, layout.cx, layout.cy, 0, 360, 38, 90);
    expect(withDefaults.map((s) => s.topPercent)).toEqual(withExplicit.map((s) => s.topPercent));
  });
});

describe('computeNearestKeywordSlots: 最上段フィルムストリップ用の「いちばん手前」キーワード抽出', () => {
  it('最小depthのキーワードのみを抽出し、より深い(遠い)キーワードは含めない', () => {
    const { computeRadialLayout, computeNearestKeywordSlots } = loadPureFns();
    const nodes = [
      ...sampleNodes,
      { id: 'k:far-east', type: 'keyword', label: 'far-east', depth: 2 },
    ];
    const layout = computeRadialLayout(nodes, 80);
    const slots = computeNearestKeywordSlots(layout.posById, layout.cx, layout.cy);
    const ids = slots.map((s) => s.id);
    expect(ids).toContain('k:north');
    expect(ids).toContain('k:east');
    expect(ids).toContain('k:south');
    expect(ids).toContain('k:west');
    expect(ids).not.toContain('k:far-east');
  });

  it('回答(answer)ノードは含めず、キーワードのみを対象にする', () => {
    const { computeRadialLayout, computeNearestKeywordSlots } = loadPureFns();
    const layout = computeRadialLayout(sampleNodes, 80);
    const slots = computeNearestKeywordSlots(layout.posById, layout.cx, layout.cy);
    expect(slots.some((s) => s.id === 'a:seed')).toBe(false);
  });

  it('方位角(bearingDeg)の昇順に並び、左右に一つずつ移動できる順序になっている', () => {
    const { computeRadialLayout, computeNearestKeywordSlots } = loadPureFns();
    const layout = computeRadialLayout(sampleNodes, 80);
    const slots = computeNearestKeywordSlots(layout.posById, layout.cx, layout.cy);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].bearingDeg).toBeGreaterThanOrEqual(slots[i - 1].bearingDeg);
    }
  });

  it('キーワードが存在しない場合は空配列を返す', () => {
    const { computeRadialLayout, computeNearestKeywordSlots } = loadPureFns();
    const layout = computeRadialLayout([{ id: 'a:seed', type: 'answer', label: 'seed', depth: 0 }], 80);
    const slots = computeNearestKeywordSlots(layout.posById, layout.cx, layout.cy);
    expect(slots).toEqual([]);
  });
});

describe('computeFilmstripOffsets: フィルムストリップのチップ間を1pxの余白のみで詰める', () => {
  it('フォーカス中のチップのoffsetは常に0(中央)である', () => {
    const { computeFilmstripOffsets } = loadPureFns();
    const offsets = computeFilmstripOffsets([40, 60, 30], 1, 1);
    expect(offsets[1]).toBe(0);
  });

  it('隣接するチップ間はgapPx(既定1px)だけ離れ、チップ幅の半分ずつを挟んだ距離になる', () => {
    const { computeFilmstripOffsets } = loadPureFns();
    const widths = [40, 60, 30];
    const offsets = computeFilmstripOffsets(widths, 1, 1);
    // 右隣(idx=2): 60/2 + 1 + 30/2 = 46
    expect(offsets[2]).toBeCloseTo(46, 5);
    // 左隣(idx=0): -(60/2 + 1 + 40/2) = -51
    expect(offsets[0]).toBeCloseTo(-51, 5);
  });

  it('gapPxを省略すると1pxが使われる', () => {
    const { computeFilmstripOffsets } = loadPureFns();
    const withDefault = computeFilmstripOffsets([40, 60], 0);
    const withExplicit = computeFilmstripOffsets([40, 60], 0, 1);
    expect(withDefault).toEqual(withExplicit);
  });

  it('チップが1件も無い場合は空配列を返す', () => {
    const { computeFilmstripOffsets } = loadPureFns();
    expect(computeFilmstripOffsets([], 0, 1)).toEqual([]);
  });
});

describe('computeAnswersForKeyword: フォーカス中のキーワードを含む回答群の抽出', () => {
  const keywordGraphNodes = [
    { id: 'a:seed', type: 'answer', label: 'seed', depth: 0 },
    { id: 'k:east', type: 'keyword', label: 'east-kw', depth: 1 },
    { id: 'a:child1', type: 'answer', label: 'child1', depth: 2 },
    { id: 'a:child2', type: 'answer', label: 'child2', depth: 2 },
  ];
  const keywordGraphEdges = [
    { from: 'a:seed', to: 'k:east' },
    { from: 'k:east', to: 'a:child1' },
    { from: 'k:east', to: 'a:child2' },
  ];

  it('キーワードを生んだ親の回答(from)と、キーワードから見つかった子の回答(to)の両方を含める', () => {
    const { computeRadialLayout, computeAnswersForKeyword } = loadPureFns();
    const layout = computeRadialLayout(keywordGraphNodes, 80);
    const answers = computeAnswersForKeyword('k:east', layout.posById, keywordGraphEdges);
    const ids = answers.map((a) => a.id);
    expect(ids).toContain('a:seed');
    expect(ids).toContain('a:child1');
    expect(ids).toContain('a:child2');
    expect(ids.length).toBe(3);
  });

  it('無関係なキーワードのidを渡すと空配列になる', () => {
    const { computeRadialLayout, computeAnswersForKeyword } = loadPureFns();
    const layout = computeRadialLayout(keywordGraphNodes, 80);
    const answers = computeAnswersForKeyword('k:unrelated', layout.posById, keywordGraphEdges);
    expect(answers).toEqual([]);
  });

  it('同じ回答が重複して含まれない', () => {
    const { computeRadialLayout, computeAnswersForKeyword } = loadPureFns();
    const layout = computeRadialLayout(keywordGraphNodes, 80);
    const dupEdges = [...keywordGraphEdges, { from: 'k:east', to: 'a:child1' }];
    const answers = computeAnswersForKeyword('k:east', layout.posById, dupEdges);
    expect(answers.filter((a) => a.id === 'a:child1').length).toBe(1);
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

async function setupActivatedFirstPersonMode() {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });

  const graphNodes = [
    { id: 'a:seed', type: 'answer', label: 'seed', depth: 0 },
    { id: 'k:north', type: 'keyword', label: 'north-kw', depth: 1 },
    { id: 'k:east', type: 'keyword', label: 'east-kw', depth: 1 },
    { id: 'k:south', type: 'keyword', label: 'south-kw', depth: 1 },
    { id: 'k:west', type: 'keyword', label: 'west-kw', depth: 1 },
    { id: 'a:child-of-east', type: 'answer', label: 'child-of-east', depth: 2, color: '#ff0000' },
  ];
  const graphEdges = [
    { from: 'a:seed', to: 'k:north' },
    { from: 'a:seed', to: 'k:east' },
    { from: 'a:seed', to: 'k:south' },
    { from: 'a:seed', to: 'k:west' },
    { from: 'k:east', to: 'a:child-of-east' },
  ];
  const fetchMock = vi.fn((url: string) => {
    if (String(url).includes('/api/aichat/shares/search')) {
      return Promise.resolve({ json: () => Promise.resolve({ results: [{ id: 'share1', question: 'q1', keywordCount: 1 }] }) });
    }
    if (String(url).includes('/api/aichat/answer-propagation-graph')) {
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

  const resultItem = document.querySelector('.search-result-row') as HTMLElement;
  resultItem.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 10));

  const fpToggleBtn = document.getElementById('fpToggleBtn')!;
  fpToggleBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  return {
    fpLeftBtn: document.getElementById('fpLeftBtn')!,
    fpRightBtn: document.getElementById('fpRightBtn')!,
    fpFilmstrip: document.getElementById('fpFilmstrip')!,
    fpAnswerList: document.getElementById('fpAnswerList')!,
  };
}

describe('一人称モードのDOM実動作(jsdom): フィルムストリップの中央固定とスワイプ/ボタンの方向', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('フォーカス中のキーワードのチップは常に画面中央(left: calc(50% + 0px))に配置される', async () => {
    const { fpFilmstrip } = await setupActivatedFirstPersonMode();
    const focused = fpFilmstrip.querySelector('.fp-film-chip-focused') as HTMLElement;
    expect(focused).not.toBeNull();
    expect(focused.style.left.replace(/\s/g, '')).toBe('calc(50%+0px)');
  });

  it('←ボタン押下でフォーカスの右隣のキーワードに新たにフォーカスが移り、そのチップが中央(薄緑色)になる', async () => {
    const { fpLeftBtn, fpFilmstrip } = await setupActivatedFirstPersonMode();
    const beforeFocused = fpFilmstrip.querySelector('.fp-film-chip-focused') as HTMLElement;
    const chipsBefore = Array.from(fpFilmstrip.querySelectorAll('.fp-film-chip')) as HTMLElement[];
    const beforeIdx = chipsBefore.indexOf(beforeFocused);
    const expectedNextLabel = chipsBefore[(beforeIdx + 1) % chipsBefore.length].textContent;

    fpLeftBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const afterFocused = fpFilmstrip.querySelector('.fp-film-chip-focused') as HTMLElement;
    expect(afterFocused.textContent).toBe(expectedNextLabel);
    expect(afterFocused.style.left.replace(/\s/g, '')).toBe('calc(50%+0px)');
  });

  it('→ボタン押下でフォーカスの左隣のキーワードに新たにフォーカスが移る(←ボタンとは逆方向)', async () => {
    const { fpRightBtn, fpFilmstrip } = await setupActivatedFirstPersonMode();
    const beforeFocused = fpFilmstrip.querySelector('.fp-film-chip-focused') as HTMLElement;
    const chipsBefore = Array.from(fpFilmstrip.querySelectorAll('.fp-film-chip')) as HTMLElement[];
    const beforeIdx = chipsBefore.indexOf(beforeFocused);
    const expectedPrevLabel = chipsBefore[(beforeIdx - 1 + chipsBefore.length) % chipsBefore.length].textContent;

    fpRightBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const afterFocused = fpFilmstrip.querySelector('.fp-film-chip-focused') as HTMLElement;
    expect(afterFocused.textContent).toBe(expectedPrevLabel);
  });
});

describe('一人称モードのDOM実動作(jsdom): フィルムストリップ直下の回答リスト', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('フォーカス中のキーワードを含む回答が、分類色のドットを行頭に置いて縦に列挙される', async () => {
    const { fpAnswerList } = await setupActivatedFirstPersonMode();
    // デフォルトのheading(0度)では k:east(bearing 0度)がフォーカスされる
    const rows = Array.from(fpAnswerList.querySelectorAll('.fp-answer-row')) as HTMLElement[];
    const labels = rows.map((r) => r.querySelector('.fp-answer-row-label')!.textContent);
    expect(labels).toContain('seed');
    expect(labels).toContain('child-of-east');

    rows.forEach((row) => {
      expect(row.firstElementChild!.className).toBe('fp-answer-row-dot');
    });
    const childRow = rows.find((r) => r.querySelector('.fp-answer-row-label')!.textContent === 'child-of-east')!;
    const dot = childRow.querySelector('.fp-answer-row-dot') as HTMLElement;
    expect(dot.style.background).toBe('rgb(255, 0, 0)');
  });

  it('フォーカスが移動すると回答リストもそのキーワードのものに切り替わる', async () => {
    const { fpLeftBtn, fpAnswerList, fpFilmstrip } = await setupActivatedFirstPersonMode();
    const beforeFocused = fpFilmstrip.querySelector('.fp-film-chip-focused')!.textContent;
    expect(beforeFocused).toBe('east-kw');
    const beforeLabels = Array.from(fpAnswerList.querySelectorAll('.fp-answer-row-label')).map((el) => el.textContent);
    expect(beforeLabels).toContain('child-of-east');

    fpLeftBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const afterLabels = Array.from(fpAnswerList.querySelectorAll('.fp-answer-row-label')).map((el) => el.textContent);
    expect(afterLabels).not.toContain('child-of-east');
  });
});
