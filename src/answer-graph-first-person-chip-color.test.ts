// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページ(src/views/answerGraph.ts)の一人称モード。
// 「📍 現在地:」直下のフィルムストリップに並ぶキーワードバッジの色を、
// そのキーワードに割り当てられているカテゴリ色(node.color)にする。
//
// 故障シナリオ:
//   (1) キーワードにcolorが割り当てられていても、バッジの枠色が固定色の
//       ままで反映されない
//   (2) 複数のキーワードで異なるcolorが割り当てられているのに、全バッジが
//       同じ色になってしまう
//   (3) colorが未割り当てのキーワードでバッジの色が空・透明になり見えなくなる
//       (フォールバック色が効いていない)

function buildPage(): string {
  return getAnswerGraphPage('testuser', {});
}

async function setupTest() {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });

  const graphNodes = [
    { id: 'a:seed', type: 'answer', label: 'seed', depth: 0 },
    { id: 'k:red', type: 'keyword', label: 'red-kw', depth: 1, color: '#ff0000' },
    { id: 'k:blue', type: 'keyword', label: 'blue-kw', depth: 1, color: '#0000ff' },
    { id: 'k:plain', type: 'keyword', label: 'plain-kw', depth: 1 },
  ];
  const graphEdges = [
    { from: 'a:seed', to: 'k:red' },
    { from: 'a:seed', to: 'k:blue' },
    { from: 'a:seed', to: 'k:plain' },
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

  return { fpFilmstrip: document.getElementById('fpFilmstrip')! };
}

function chipByLabel(fpFilmstrip: HTMLElement, label: string) {
  return Array.from(fpFilmstrip.querySelectorAll('.fp-film-chip')).find((c) => c.textContent === label) as HTMLElement;
}

describe('一人称モード フィルムストリップのキーワードバッジ色: そのキーワードに割り当てられている色を使う', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('colorが割り当てられているキーワードは、そのバッジの枠色になる', async () => {
    const { fpFilmstrip } = await setupTest();
    expect(chipByLabel(fpFilmstrip, 'red-kw').style.borderColor).toBe('rgb(255, 0, 0)');
    expect(chipByLabel(fpFilmstrip, 'blue-kw').style.borderColor).toBe('rgb(0, 0, 255)');
  });

  it('異なるキーワード同士で異なる色になる(全バッジが同じ色に潰れない)', async () => {
    const { fpFilmstrip } = await setupTest();
    const red = chipByLabel(fpFilmstrip, 'red-kw').style.borderColor;
    const blue = chipByLabel(fpFilmstrip, 'blue-kw').style.borderColor;
    expect(red).not.toBe(blue);
  });

  it('colorが未割り当てのキーワードはフォールバック色(--keyword-colorの既定値 #c2410c)が使われる', async () => {
    const { fpFilmstrip } = await setupTest();
    expect(chipByLabel(fpFilmstrip, 'plain-kw').style.borderColor).toBe('rgb(194, 65, 12)');
  });
});
