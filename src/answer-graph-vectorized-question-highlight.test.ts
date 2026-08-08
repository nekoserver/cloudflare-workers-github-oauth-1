// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページの起点検索結果テーブル(#seedSearchResults)で、
// 各質問行に対応する回答文が既にベクタ化済み(aichat_answer_vectors、
// APIレスポンスのvectorizedフラグ)かどうかに応じて、質問セル
// (.search-result-question)に vectorized-question クラスを付与し
// 背景色を薄緑色に塗り分ける機能。
//
// 故障シナリオ:
//   (1) vectorized:trueの結果でもクラスが付与されない(塗り分けが効かない)
//   (2) vectorized:falseの結果にも誤ってクラスが付与される
//   (3) vectorizedフィールド自体が欠けている(undefined)場合に例外になる

function buildPage(): string {
  return getAnswerGraphPage('testuser', {}, false);
}

async function setupVectorizedHighlightTest(results: unknown[]) {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });

  const fetchMock = vi.fn((url: string) => {
    const u = String(url);
    if (u.includes('/api/aichat/shares/search')) {
      return Promise.resolve({ json: () => Promise.resolve({ results }) });
    }
    return Promise.resolve({ json: () => Promise.resolve({}) });
  });
  vi.stubGlobal('fetch', fetchMock);

  const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();

  await new Promise((resolve) => setTimeout(resolve, 10));

  const seedSearchInput = document.getElementById('seedSearchInput') as HTMLInputElement;
  seedSearchInput.value = 'q';
  seedSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 400));

  return document.getElementById('seedSearchResults')!;
}

describe('起点検索結果テーブル(DOM実動作): ベクタ化済み質問の背景色塗り分け', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('vectorized:trueの質問セルにはvectorized-questionクラスが付与される', async () => {
    const seedSearchResults = await setupVectorizedHighlightTest([
      { id: 's1', question: 'ベクタ化済みの質問', created_at: '2026-01-01T00:00:00.000Z', keywordCount: 1, vectorized: true },
    ]);
    const cell = seedSearchResults.querySelector('.search-result-question') as HTMLElement;
    expect(cell.classList.contains('vectorized-question')).toBe(true);
  });

  it('vectorized:falseの質問セルにはvectorized-questionクラスが付与されない', async () => {
    const seedSearchResults = await setupVectorizedHighlightTest([
      { id: 's1', question: '未ベクタ化の質問', created_at: '2026-01-01T00:00:00.000Z', keywordCount: 1, vectorized: false },
    ]);
    const cell = seedSearchResults.querySelector('.search-result-question') as HTMLElement;
    expect(cell.classList.contains('vectorized-question')).toBe(false);
  });

  it('vectorizedフィールドが欠けている場合も例外にならずクラスを付与しない', async () => {
    const seedSearchResults = await setupVectorizedHighlightTest([
      { id: 's1', question: 'フィールド欠落の質問', created_at: '2026-01-01T00:00:00.000Z', keywordCount: 1 },
    ]);
    const cell = seedSearchResults.querySelector('.search-result-question') as HTMLElement;
    expect(cell.classList.contains('vectorized-question')).toBe(false);
  });
});
