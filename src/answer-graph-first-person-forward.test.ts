// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページ(src/views/answerGraph.ts)の一人称モード。
// 「移動するのは回答文ノードの上」であり、その回答文に含まれるキーワード群が
// 目の前(フィルムストリップ)に展開される、というテイに作り直した。
// ↑ボタン(forwardFirstPerson)は、フォーカス中のキーワードを含む回答のうち
// 今立っている回答より奥(depthが大きい)にあるものへ実際に進む。
//
// 故障シナリオ:
//   (1) ↑ボタンを押しても立っている回答文ノード(現在地)が変わらない
//   (2) フォーカス中のキーワードに対応する「先」の回答ではなく、無関係な
//       回答や後退方向(親)の回答へ進んでしまう
//   (3) それ以上先の回答が存在しない(行き止まり)場合にエラーで落ちる、
//       またはフィルムストリップが空になって表示が壊れる
//   (4) 葉(それ以上先が無い)回答からさらに↑を押すと、そのキーワードを
//       生んだ親の回答へ逆戻りしてしまう(↑が前進を保証しない)
//   (5) 視点を進めた後、直下の回答一覧(fpAnswerList)が新しい現在地の
//       ものに切り替わらない

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

  // k:east は a:mid -> k:far -> a:end まで繋がる枝、k:deadend は行き止まり
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
  const fpHere = document.getElementById('fpHere')!;

  function focusChip(label: string) {
    const chip = Array.from(fpFilmstrip.querySelectorAll('.fp-film-chip')).find((c) => c.textContent === label) as HTMLElement;
    chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  return { fpFilmstrip, fpForwardBtn, fpAnswerList, fpHere, focusChip };
}

function filmstripLabels(fpFilmstrip: HTMLElement) {
  return Array.from(fpFilmstrip.querySelectorAll('.fp-film-chip')).map((c) => c.textContent).sort();
}

describe('一人称モード ↑ボタン(forwardFirstPerson): 回答文ノードの上を移動し、目の前にそのキーワード群を展開する', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('起動直後は起点(seed)の上に立ち、目の前にseedのキーワードが並ぶ', async () => {
    const { fpFilmstrip, fpHere } = await setupForwardTest();
    expect(filmstripLabels(fpFilmstrip)).toEqual(['deadend-kw', 'east-kw']);
    expect(fpHere.textContent).toContain('seed');
  });

  it('east-kwにフォーカスして↑を押すと、mid-answerの上に立ち、現在地表示も更新される', async () => {
    const { fpFilmstrip, fpForwardBtn, fpHere, focusChip } = await setupForwardTest();

    focusChip('east-kw');
    fpForwardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(fpHere.textContent).toContain('mid-answer');
    // mid-answerの回答文には、そこへ導いたeast-kwと、そこから見つかったfar-kwの両方が含まれる
    expect(filmstripLabels(fpFilmstrip)).toEqual(['east-kw', 'far-kw']);
  });

  it('mid-answerからfar-kwにフォーカスして↑を押すと、end-answerの上に立つ(親のmid-answerへ逆戻りしない)', async () => {
    const { fpFilmstrip, fpForwardBtn, fpHere, focusChip } = await setupForwardTest();

    focusChip('east-kw');
    fpForwardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    focusChip('far-kw');
    fpForwardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(fpHere.textContent).toContain('end-answer');
    expect(filmstripLabels(fpFilmstrip)).toEqual(['far-kw']);
  });

  it('end-answer(葉)からさらに↑を押しても、親(mid-answer)へ逆戻りせず行き止まりのまま留まる', async () => {
    const { fpFilmstrip, fpForwardBtn, fpHere, focusChip } = await setupForwardTest();

    focusChip('east-kw');
    fpForwardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    focusChip('far-kw');
    fpForwardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fpForwardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(fpHere.textContent).toContain('end-answer');
    expect(filmstripLabels(fpFilmstrip)).toEqual(['far-kw']);
  });

  it('deadend-kw(その先に進める回答が無い)で↑を押しても、現在地は変わらない', async () => {
    const { fpFilmstrip, fpForwardBtn, fpHere, focusChip } = await setupForwardTest();

    focusChip('deadend-kw');
    fpForwardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(fpHere.textContent).toContain('seed');
    expect(filmstripLabels(fpFilmstrip)).toEqual(['deadend-kw', 'east-kw']);
  });

  it('視点を進めた後、直下の回答一覧が新しい現在地(mid-answer)から先に進める候補に切り替わる', async () => {
    const { fpForwardBtn, fpAnswerList, focusChip } = await setupForwardTest();

    focusChip('east-kw');
    fpForwardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    focusChip('far-kw');

    expect(fpAnswerList.textContent).toContain('end-answer');
  });
});
