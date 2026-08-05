// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページ(src/views/answerGraph.ts)の一人称モードにある
// ↑ボタン(forwardFirstPerson)。従来はFOV内でheadingに最も近いノードを
// selectGraphNode(隠れているsidePanelを更新するだけ)するのみで、視点
// (フィルムストリップ・見えているキーワード層)が実際には一切進まなかった。
// フォーカス中のキーワードから一層外側のキーワード層(間の回答層は素通り)へ
// 視点を進めるように修正した。
//
// 故障シナリオ:
//   (1) ↑ボタンを押してもフィルムストリップの表示内容(見えているキーワード層)
//       が変わらない(視点が進んだように見えない)
//   (2) 一層外側にさらにキーワード層が存在するのに、無関係な層や同じ層に
//       留まってしまう
//   (3) それ以上先のキーワード層が存在しない(行き止まり)場合にエラーで
//       落ちる、またはフィルムストリップが空になって表示が壊れる
//   (4) 視点を進めた後、直下の回答一覧(fpAnswerList)が新しいフォーカス
//       キーワードのものに切り替わらない

function buildPage(): string {
  return getAnswerGraphPage('testuser', {});
}

async function setupForwardTest() {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });

  // k:east は depth3(k:far)まで繋がる枝、k:deadend は depth1止まりの行き止まり枝
  const graphNodes = [
    { id: 'a:seed', type: 'answer', label: 'seed', depth: 0 },
    { id: 'k:east', type: 'keyword', label: 'east-kw', depth: 1 },
    { id: 'k:deadend', type: 'keyword', label: 'deadend-kw', depth: 1 },
    { id: 'a:mid', type: 'answer', label: 'mid-answer', depth: 2 },
    { id: 'k:far', type: 'keyword', label: 'far-kw', depth: 3 },
    { id: 'a:end', type: 'answer', label: 'end-answer', depth: 4 },
  ];
  const graphEdges = [
    { from: 'a:seed', to: 'k:east' },
    { from: 'a:seed', to: 'k:deadend' },
    { from: 'k:east', to: 'a:mid' },
    { from: 'a:mid', to: 'k:far' },
    { from: 'k:far', to: 'a:end' },
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

  const fpFilmstrip = document.getElementById('fpFilmstrip')!;
  const fpForwardBtn = document.getElementById('fpForwardBtn')!;
  const fpAnswerList = document.getElementById('fpAnswerList')!;

  function focusChip(label: string) {
    const chip = Array.from(fpFilmstrip.querySelectorAll('.fp-film-chip')).find((c) => c.textContent === label) as HTMLElement;
    chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  return { fpFilmstrip, fpForwardBtn, fpAnswerList, focusChip };
}

describe('一人称モード ↑ボタン(forwardFirstPerson): 一層外のキーワード層へ視点を進める', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('east-kwにフォーカスして↑を押すと、間のmid-answer層を飛ばしてfar-kw(depth3)がフィルムストリップに現れる', async () => {
    const { fpFilmstrip, fpForwardBtn, focusChip } = await setupForwardTest();

    focusChip('east-kw');
    fpForwardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const labels = Array.from(fpFilmstrip.querySelectorAll('.fp-film-chip')).map((c) => c.textContent);
    expect(labels).toEqual(['far-kw']);
    const focused = fpFilmstrip.querySelector('.fp-film-chip-focused');
    expect(focused && focused.textContent).toBe('far-kw');
  });

  it('視点を進めた後、直下の回答一覧が新しいフォーカスキーワード(far-kw)を含む回答に切り替わる', async () => {
    const { fpForwardBtn, fpAnswerList, focusChip } = await setupForwardTest();

    focusChip('east-kw');
    fpForwardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(fpAnswerList.textContent).toContain('end-answer');
  });

  it('deadend-kw(depth1、その先にキーワード層が無い)で↑を押しても、フィルムストリップは変わらず行き止まりのままになる', async () => {
    const { fpFilmstrip, fpForwardBtn, focusChip } = await setupForwardTest();

    focusChip('deadend-kw');
    fpForwardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const labels = Array.from(fpFilmstrip.querySelectorAll('.fp-film-chip')).map((c) => c.textContent).sort();
    expect(labels).toEqual(['deadend-kw', 'east-kw']);
    const focused = fpFilmstrip.querySelector('.fp-film-chip-focused');
    expect(focused && focused.textContent).toBe('deadend-kw');
  });

  it('east-kwから↑を2回押すと、far-kwの先にキーワード層が無いため2回目は行き止まりでfar-kwに留まる', async () => {
    const { fpFilmstrip, fpForwardBtn, focusChip } = await setupForwardTest();

    focusChip('east-kw');
    fpForwardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fpForwardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const labels = Array.from(fpFilmstrip.querySelectorAll('.fp-film-chip')).map((c) => c.textContent);
    expect(labels).toEqual(['far-kw']);
  });
});
