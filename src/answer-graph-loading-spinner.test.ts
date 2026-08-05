// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページ(src/views/answerGraph.ts)の起点検索結果テーブル。
// キーワード数(🔑)が0以外の質問文の行をタップしてグラフ取得(loadGraph)を
// 開始してから、レスポンスが返ってくるまでの間、画面中央に回転式のローディング
// インジケータ(#seedLoadingSpinner)を表示し続ける。
//
// 故障シナリオ:
//   (1) 行タップ直後にインジケータが表示されない(読み込み中であることが
//       利用者にわからない)
//   (2) レスポンス到着後もインジケータが表示されたままになる
//   (3) グラフ取得がエラー(非200・通信エラー)で終わった場合にインジケータが
//       表示されたままになる(エラー時だけ消し忘れる)
//   (4) キーワード数0件行(ツールチップ表示のみでloadGraphを呼ばない行)を
//       タップしてもインジケータが誤って表示されてしまう

function buildPage(): string {
  return getAnswerGraphPage('testuser', {});
}

async function setupWithDeferredGraphFetch(results: Array<{ id: string; question: string; created_at: string; keywordCount: number }>) {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });

  let resolveGraphFetch: (v: { status: number; text: () => Promise<string> }) => void = () => {};
  const graphFetchPromise = new Promise<{ status: number; text: () => Promise<string> }>((resolve) => { resolveGraphFetch = resolve; });
  const fetchMock = vi.fn((url: string) => {
    if (String(url).includes('/api/aichat/shares/search')) {
      return Promise.resolve({ json: () => Promise.resolve({ results }) });
    }
    if (String(url).includes('/api/aichat/answer-propagation-graph')) {
      return graphFetchPromise;
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

  return {
    spinner: document.getElementById('seedLoadingSpinner')!,
    resolveGraphFetch: (status: number, body: unknown) => resolveGraphFetch({ status, text: () => Promise.resolve(JSON.stringify(body)) }),
  };
}

describe('起点検索結果テーブル: 行タップ時の中央ローディングインジケータ', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('キーワード数が1件以上の行をタップすると読み込み中の間インジケータが表示される', async () => {
    const { spinner, resolveGraphFetch } = await setupWithDeferredGraphFetch([
      { id: 's-one', question: 'キーワード有り質問', created_at: '2026-01-01T00:00:00.000Z', keywordCount: 3 },
    ]);
    expect(spinner.classList.contains('active')).toBe(false);

    const row = document.querySelector('.search-result-row') as HTMLElement;
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(spinner.classList.contains('active')).toBe(true);

    resolveGraphFetch(200, { nodes: [], edges: [] });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(spinner.classList.contains('active')).toBe(false);
  });

  it('グラフ取得がエラーで終わってもインジケータは消える', async () => {
    const { spinner, resolveGraphFetch } = await setupWithDeferredGraphFetch([
      { id: 's-one', question: 'キーワード有り質問', created_at: '2026-01-01T00:00:00.000Z', keywordCount: 3 },
    ]);
    const row = document.querySelector('.search-result-row') as HTMLElement;
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(spinner.classList.contains('active')).toBe(true);

    resolveGraphFetch(500, { error: 'テストエラー' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(spinner.classList.contains('active')).toBe(false);
  });

  it('キーワード数0件の行をタップしてもインジケータは表示されない(loadGraphが呼ばれないため)', async () => {
    const { spinner } = await setupWithDeferredGraphFetch([
      { id: 's-zero', question: 'キーワード無し質問', created_at: '2026-01-01T00:00:00.000Z', keywordCount: 0 },
    ]);
    const row = document.querySelector('.search-result-row') as HTMLElement;
    row.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(spinner.classList.contains('active')).toBe(false);
  });
});
