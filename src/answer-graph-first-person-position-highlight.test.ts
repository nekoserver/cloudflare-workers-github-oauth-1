// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページ(src/views/answerGraph.ts)。
//   (1) 一人称モードの↑ボタンの下に新設した↓ボタン(backwardFirstPerson)。
//       一層外(↑)の逆で、フォーカス中のキーワードから一層内側のキーワード
//       層(間の回答層は素通り)へ視点を戻す
//   (2) 俯瞰グラフビュー(drawGraph)で、一人称モードで「今いる」キーワード
//       ノード(currentKeywordNodeId)を薄緑色(--fp-focus-bg)で塗りつぶす
//   (3) 俯瞰グラフビューで、現在選択中(selectGraphNode)の質問ノードから、
//       その回答文内に含まれる(=辺で直接繋がっている)各キーワードノードまで
//       を強調線(--accent、太め)で結ぶ
//
// 故障シナリオ:
//   (1) ↓ボタンを押しても一層内側のキーワード層に戻らない、または
//       無関係な層に飛んでしまう
//   (2) 一層内側にこれ以上戻れない(root付近)場合にエラーで落ちる
//   (3) 一人称モードから俯瞰ビューに戻っても「今いる」キーワードノードが
//       ハイライトされない(薄緑色で塗られない)
//   (4) 質問ノードを選択しても、その回答文に含まれるキーワードノードへの
//       強調線が引かれない、または無関係なノードまで線が引かれてしまう

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

// a:seed -> k:a -> a:mid -> (k:x, k:y) : a:midの「回答文」にk:x・k:yの2キーワードが含まれる形
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

async function setupTest() {
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
  fpToggleBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  return {
    fpToggleBtn,
    fpForwardBtn: document.getElementById('fpForwardBtn')!,
    fpBackwardBtn: document.getElementById('fpBackwardBtn')!,
    fpFilmstrip: document.getElementById('fpFilmstrip')!,
    fpAnswerList: document.getElementById('fpAnswerList')!,
    strokes,
    fills,
  };
}

describe('一人称モード ↓ボタン(backwardFirstPerson): 一層内のキーワード層へ視点を戻す', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('id="fpBackwardBtn"が↑ボタンの下に存在する', () => {
    const html = buildPage();
    const upIdx = html.indexOf('id="fpForwardBtn"');
    const downIdx = html.indexOf('id="fpBackwardBtn"');
    expect(upIdx).toBeGreaterThan(-1);
    expect(downIdx).toBeGreaterThan(upIdx);
  });

  it('↑で一層外(kw-x/kw-y)へ進んだ後、↓を押すと一層内(kw-a)へ戻る', async () => {
    const { fpForwardBtn, fpBackwardBtn, fpFilmstrip } = await setupTest();

    fpForwardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    let labels = Array.from(fpFilmstrip.querySelectorAll('.fp-film-chip')).map((c) => c.textContent).sort();
    expect(labels).toEqual(['kw-x', 'kw-y']);

    fpBackwardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    labels = Array.from(fpFilmstrip.querySelectorAll('.fp-film-chip')).map((c) => c.textContent);
    expect(labels).toEqual(['kw-a']);
  });

  it('これ以上内側に戻れない(root付近)場合はフィルムストリップが変化しない', async () => {
    const { fpBackwardBtn, fpFilmstrip } = await setupTest();

    fpBackwardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const labels = Array.from(fpFilmstrip.querySelectorAll('.fp-film-chip')).map((c) => c.textContent);
    expect(labels).toEqual(['kw-a']);
  });
});

describe('俯瞰グラフビュー: 一人称モードで「今いる」キーワードノードの薄緑色ハイライト', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('一人称モードでkw-aにいる状態から俯瞰ビューに戻ると、kw-aだけが薄緑色(--fp-focus-bgの既定値 #d1f5d3)で塗られる', async () => {
    const { fpToggleBtn, fills } = await setupTest();
    fills.length = 0;

    fpToggleBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); // 俯瞰ビューへ戻る

    const highlighted = fills.filter((f) => f.fillStyle === '#d1f5d3');
    expect(highlighted.length).toBe(1);
  });
});

describe('俯瞰グラフビュー: 選択中の質問ノードから回答文内のキーワードノードへの強調線', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('a:mid(回答)を選択して俯瞰ビューに戻ると、辺で繋がるkw-a・kw-x・kw-yへの強調線(--accentの既定値 #0969da、lineWidth 2.5)が3本引かれる(a:midの回答文にはkw-a・kw-x・kw-yがすべて含まれている)', async () => {
    const { fpToggleBtn, fpAnswerList, strokes } = await setupTest();

    // fpAnswerList にはkw-aを含む回答として seed(親) と mid-answer(kw-aの発見元
    // であり、かつkw-x/kw-yを含む回答)の2件が並ぶ。強調線の対象はmid-answerの方。
    const row = Array.from(fpAnswerList.querySelectorAll('.fp-answer-row'))
      .find((el) => el.textContent === 'mid-answer') as HTMLElement;
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    strokes.length = 0;

    fpToggleBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); // 俯瞰ビューへ戻る

    const highlightStrokes = strokes.filter((s) => s.strokeStyle === '#0969da' && s.lineWidth === 2.5);
    expect(highlightStrokes.length).toBe(3);
  });

  it('未選択(selectedNodeIdなし)の状態で俯瞰ビューを描画しても強調線は引かれない', async () => {
    const { fpToggleBtn, strokes } = await setupTest();
    strokes.length = 0;

    fpToggleBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const highlightStrokes = strokes.filter((s) => s.strokeStyle === '#0969da' && s.lineWidth === 2.5);
    expect(highlightStrokes.length).toBe(0);
  });
});
