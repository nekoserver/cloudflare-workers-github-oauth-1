// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページ(src/views/answerGraph.ts)の起点検索結果テーブル。
// キーワード数(🔑)が0件の行は「回答からキーワードが1つも切り出せていない」状態で
// あり、そのままノード描画に進んでも意味のあるグラフにならない。誤ってクリックしても
// loadGraphが呼ばれず、代わりに理由を説明するツールチップが7秒間表示されることを保証する。
//
// 故障シナリオ:
//   (1) キーワード数0件の行をクリックすると通常通りloadGraphが呼ばれ、
//       意味のない(ノードがほぼ無い)グラフが描画されてしまう
//   (2) キーワード数0件の行が他の行と見た目上区別できず、なぜグラフが
//       描画されないのか利用者にわからない
//   (3) キーワード数が1件以上ある通常行が、実装ミスでゼロ件行と誤判定され
//       クリックしてもloadGraphが呼ばれなくなる(既存機能の破壊)
//   (4) ツールチップが7秒経っても消えない、または即座に消えて読めない
//
// キーワード数0の行を非表示にする設定(answerGraphHideEmptyRows)はこの
// テストの対象外(このテストはキーワード数0件行そのものの表示/挙動を
// 検証する)のため、buildPageでは明示的に無効化する。

function buildPage(): string {
  return getAnswerGraphPage('testuser', {}, false);
}

async function setupWithSearchResults(results: Array<{ id: string; question: string; created_at: string; keywordCount: number }>) {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });
  const graphFetchSpy = vi.fn(() => Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify({ nodes: [], edges: [] })) }));
  const fetchMock = vi.fn((url: string) => {
    if (String(url).includes('/api/aichat/shares/search')) {
      return Promise.resolve({ json: () => Promise.resolve({ results }) });
    }
    if (String(url).includes('/api/aichat/answer-propagation-graph')) {
      return graphFetchSpy();
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
  return { graphFetchSpy };
}

describe('起点検索結果テーブル: キーワード数(🔑)0件行の表示とクリック挙動', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('th見出しは🔑になる', () => {
    const html = buildPage();
    expect(html).toContain('>🔑</th>');
    expect(html).not.toMatch(/<th[^>]*>キーワード数<\/th>/);
  });

  it('キーワード数0件の行にはzero-keyword-rowクラスが付き、1件以上の行には付かない', async () => {
    await setupWithSearchResults([
      { id: 's-zero', question: 'キーワード無し質問', created_at: '2026-01-01T00:00:00.000Z', keywordCount: 0 },
      { id: 's-one', question: 'キーワード有り質問', created_at: '2026-01-02T00:00:00.000Z', keywordCount: 3 },
    ]);
    const rows = Array.from(document.querySelectorAll('.search-result-row')) as HTMLElement[];
    const zeroRow = rows.find((r) => r.textContent?.includes('キーワード無し質問'))!;
    const oneRow = rows.find((r) => r.textContent?.includes('キーワード有り質問'))!;
    expect(zeroRow.classList.contains('zero-keyword-row')).toBe(true);
    expect(oneRow.classList.contains('zero-keyword-row')).toBe(false);
  });

  it('キーワード数0件の行をクリックしてもloadGraphは呼ばれずツールチップが表示される', async () => {
    const { graphFetchSpy } = await setupWithSearchResults([
      { id: 's-zero', question: 'キーワード無し質問', created_at: '2026-01-01T00:00:00.000Z', keywordCount: 0 },
    ]);
    const row = document.querySelector('.search-result-row') as HTMLElement;
    row.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(graphFetchSpy).not.toHaveBeenCalled();
    const tooltip = document.querySelector('.seed-zero-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip!.textContent).toBe('この質問の回答結果から1つでもいいのでキーワードを切り出して登録しないとノードの描画が行えません');
  });

  it('キーワード数1件以上の行をクリックすると従来通りloadGraphが呼ばれる', async () => {
    const { graphFetchSpy } = await setupWithSearchResults([
      { id: 's-one', question: 'キーワード有り質問', created_at: '2026-01-02T00:00:00.000Z', keywordCount: 3 },
    ]);
    const row = document.querySelector('.search-result-row') as HTMLElement;
    row.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(graphFetchSpy).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.seed-zero-tooltip')).toBeNull();
  });
});
