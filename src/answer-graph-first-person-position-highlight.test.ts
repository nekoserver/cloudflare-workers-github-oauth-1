// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページ(src/views/answerGraph.ts)。
//   (1) 一人称モードの↑ボタンの下に新設した↓ボタン(backwardFirstPerson)。
//       「今立っている回答文ノード」を見つけ出した入口のキーワードを経由して、
//       その親の回答文ノードへ戻る
//   (2) 俯瞰グラフビュー(drawGraph)で、一人称モードで「今立っている」
//       回答文ノード(currentAnswerNode)を薄緑色(--fp-focus-bg)で塗りつぶす
//   (3) 俯瞰グラフビューで、選択中(selectGraphNode)または今立っている
//       質問ノードから、その回答文内に含まれる(=辺で直接繋がっている)
//       各キーワードノードまでを強調線(--accent、太め)で結ぶ
//
// 故障シナリオ:
//   (1) ↓ボタンを押しても親の回答文ノードへ戻らない、または無関係な
//       ノードへ飛んでしまう
//   (2) 親が存在しない(root付近)場合にエラーで落ちる
//   (3) 一人称モードから俯瞰ビューに戻っても「今立っている」回答文ノードが
//       ハイライトされない(薄緑色で塗られない)
//   (4) 質問ノードを選択/一人称モードで立っていても、その回答文に含まれる
//       キーワードノードへの強調線が引かれない、または無関係なノードまで
//       線が引かれてしまう
//   (5) 何も選択・移動していない状態でも強調線が引かれてしまう

function buildPage(): string {
  return getAnswerGraphPage('testuser', {});
}

function makeRecordingCtx() {
  const strokes: Array<{ strokeStyle: string; lineWidth: number }> = [];
  const fills: Array<{ fillStyle: string }> = [];
  const ctx: Record<string, unknown> = {
    clearRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    fill: () => { fills.push({ fillStyle: String(ctx.fillStyle) }); },
    stroke: () => { strokes.push({ strokeStyle: String(ctx.strokeStyle), lineWidth: Number(ctx.lineWidth) }); },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  };
  return { ctx, strokes, fills };
}

// a:seed -> k:a -> a:mid -> (k:x, k:y) : a:midの「回答文」にk:a・k:x・k:yの3キーワードが含まれる形
const graphNodes = [
  { id: 'a:seed', type: 'answer', label: 'seed', depth: 0 },
  { id: 'k:a', type: 'keyword', label: 'kw-a', depth: 1 },
  { id: 'a:mid', type: 'answer', label: 'mid-answer', depth: 2 },
  { id: 'k:x', type: 'keyword', label: 'kw-x', depth: 3 },
  { id: 'k:y', type: 'keyword', label: 'kw-y', depth: 3 },
];
const graphEdges = [
  { from: 'a:seed', to: 'k:a' },
  { from: 'k:a', to: 'a:mid' },
  { from: 'a:mid', to: 'k:x' },
  { from: 'a:mid', to: 'k:y' },
];

async function setupTest(opts?: { enterFpMode?: boolean }) {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
  const { ctx, strokes, fills } = makeRecordingCtx();
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ctx;

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
  if (opts?.enterFpMode !== false) {
    fpToggleBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  function focusChip(label: string) {
    const fpFilmstrip = document.getElementById('fpFilmstrip')!;
    const chip = Array.from(fpFilmstrip.querySelectorAll('.fp-film-chip')).find((c) => c.textContent === label) as HTMLElement;
    chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  return {
    fpToggleBtn,
    fpForwardBtn: document.getElementById('fpForwardBtn')!,
    fpBackwardBtn: document.getElementById('fpBackwardBtn')!,
    fpFilmstrip: document.getElementById('fpFilmstrip')!,
    fpAnswerList: document.getElementById('fpAnswerList')!,
    fpHere: document.getElementById('fpHere')!,
    focusChip,
    strokes,
    fills,
  };
}

describe('一人称モード ↓ボタン(backwardFirstPerson): 親の回答文ノードへ戻る', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('id="fpBackwardBtn"が↑ボタンの下に存在する', () => {
    const html = buildPage();
    const upIdx = html.indexOf('id="fpForwardBtn"');
    const downIdx = html.indexOf('id="fpBackwardBtn"');
    expect(upIdx).toBeGreaterThan(-1);
    expect(downIdx).toBeGreaterThan(upIdx);
  });

  it('kw-aで↑を押してmid-answerへ進んだ後、↓を押すとseedへ戻る', async () => {
    const { fpForwardBtn, fpBackwardBtn, fpHere, focusChip } = await setupTest();

    focusChip('kw-a');
    fpForwardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(fpHere.textContent).toContain('mid-answer');

    fpBackwardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(fpHere.textContent).toContain('seed');
  });

  it('これ以上内側に戻れない(root付近)場合は現在地が変化しない', async () => {
    const { fpBackwardBtn, fpHere } = await setupTest();

    fpBackwardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(fpHere.textContent).toContain('seed');
  });
});

describe('俯瞰グラフビュー: 一人称モードで「今立っている」回答文ノードの薄緑色ハイライト', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('一人称モードでseedに立っている状態から俯瞰ビューに戻ると、seedだけが薄緑色(--fp-focus-bgの既定値 #d1f5d3)で塗られる', async () => {
    const { fpToggleBtn, fills } = await setupTest();
    fills.length = 0;

    fpToggleBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); // 俯瞰ビューへ戻る

    const highlighted = fills.filter((f) => f.fillStyle === '#d1f5d3');
    expect(highlighted.length).toBe(1);
  });

  it('mid-answerへ進んでから俯瞰ビューに戻ると、mid-answerが薄緑色で塗られる(seedはもう塗られない)', async () => {
    const { fpToggleBtn, fpForwardBtn, fills, focusChip } = await setupTest();
    focusChip('kw-a');
    fpForwardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fills.length = 0;

    fpToggleBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const highlighted = fills.filter((f) => f.fillStyle === '#d1f5d3');
    expect(highlighted.length).toBe(1);
  });
});

describe('俯瞰グラフビュー: 選択中/今立っている質問ノードから回答文内のキーワードノードへの強調線', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('一人称モードでmid-answerに立って俯瞰ビューに戻ると、辺で繋がるkw-a・kw-x・kw-yへの強調線(--accentの既定値 #0969da、lineWidth 2.5)が3本引かれる', async () => {
    const { fpToggleBtn, fpForwardBtn, strokes, focusChip } = await setupTest();
    focusChip('kw-a');
    fpForwardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    strokes.length = 0;

    fpToggleBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); // 俯瞰ビューへ戻る

    const highlightStrokes = strokes.filter((s) => s.strokeStyle === '#0969da' && s.lineWidth === 2.5);
    expect(highlightStrokes.length).toBe(3);
  });

  it('一人称モードを一度も使わず、何も選択していない状態で俯瞰ビューを描画しても強調線は引かれない', async () => {
    const { strokes } = await setupTest({ enterFpMode: false });
    // setupTest内のloadGraph成功時点で既に1回drawGraphが走っているため、そこまでの
    // strokesをクリアしてから改めて何もせず確認する必要はない
    // (currentAnswerNode/selectedNodeIdはどちらも初期状態でnullのまま)。
    const highlightStrokes = strokes.filter((s) => s.strokeStyle === '#0969da' && s.lineWidth === 2.5);
    expect(highlightStrokes.length).toBe(0);
  });
});
