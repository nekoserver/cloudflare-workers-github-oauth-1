// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページの回答モーダル「キーワード一覧」ボタン
// (#answerModalKeywordListBtn)。押すと最上位レイヤーの予備知識モーダルに
// 「キーワード (出現回数)」バッジを分類色付きで一覧表示する。
// グラフが既に読み込まれ、開いている回答文がノードとして含まれる場合は、
// 「この回答文のキーワード:」バー(#answerKeywordsBar)と同じキャッシュ
// (keywordCountMap/keywordCategoryMap/catQuickData)から出現回数・分類色を
// 組み立て、/api/aichat/answer-keywordsへ問い合わせない。
//
// 故障シナリオ:
//   (1) グラフ読み込み済みでもキャッシュを使わず毎回DBに問い合わせてしまう
//   (2) キャッシュ由来の出現回数・分類色が実際のDB問い合わせ結果と食い違う
//   (3) グラフ未読み込み・対象ノードがグラフに含まれない場合にキャッシュが
//       使えず、その際に従来通りDBへフォールバックできない

function buildPage(): string {
  return getAnswerGraphPage('testuser', {}, false);
}

function openAnswerModalViaClick(shareId: string) {
  const q = document.createElement('a');
  q.className = 'question-line';
  q.setAttribute('data-share-id', shareId);
  document.body.appendChild(q);
  q.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  q.remove();
}

async function setupKeywordListCacheTest(options: { loadGraph: boolean }) {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });

  const graphNodes = [
    { id: 'a:s1', type: 'answer', label: '起点質問', depth: 0 },
    { id: 'k:東京駅', type: 'keyword', label: '東京駅', depth: 1 },
    { id: 'k:新幹線', type: 'keyword', label: '新幹線', depth: 1 },
  ];
  const graphEdges = [
    { from: 'a:s1', to: 'k:東京駅' },
    { from: 'a:s1', to: 'k:新幹線' },
  ];
  const answerKeywordsCalls: string[] = [];
  const fetchMock = vi.fn((url: string) => {
    const u = String(url);
    if (u.includes('/api/aichat/shares/search')) {
      return Promise.resolve({ json: () => Promise.resolve({ results: [{ id: 's1', question: '起点質問', created_at: '2026-01-01T00:00:00.000Z', keywordCount: 2 }] }) });
    }
    if (u.includes('/api/aichat/answer-propagation-graph')) {
      return Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify({ nodes: graphNodes, edges: graphEdges })) });
    }
    if (u.includes('/api/aichat/all-keywords')) {
      return Promise.resolve({ json: () => Promise.resolve({ keywords: [
        { keyword: '東京駅', cnt: 5, category_id: 1 },
        { keyword: '新幹線', cnt: 0 },
      ] }) });
    }
    if (u.includes('/api/aichat/category-groups')) {
      return Promise.resolve({ json: () => Promise.resolve({ groups: [] }) });
    }
    if (u.includes('/api/aichat/keyword-categories-summary')) {
      return Promise.resolve({ json: () => Promise.resolve({ categories: [{ id: 1, name: '交通', color: '#3b82f6' }] }) });
    }
    if (u.includes('/api/aichat/answer-keywords')) {
      answerKeywordsCalls.push(u);
      return Promise.resolve({ json: () => Promise.resolve({ keywordOccurrences: [
        { keyword: '東京駅', count: 999, classified: true, categoryColor: '#000000' },
      ] }) });
    }
    if (u.includes('share-keywords')) {
      return Promise.resolve({ json: () => Promise.resolve({ keywords: [] }) });
    }
    if (u.includes('/api/aichat/shares/')) {
      return Promise.resolve({ json: () => Promise.resolve({ id: 's1', question: '起点質問', answer: '回答文', vectorized: true, keywordsRegistered: true }) });
    }
    return Promise.resolve({ json: () => Promise.resolve({}) });
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('alert', vi.fn());

  const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();

  await new Promise((resolve) => setTimeout(resolve, 10));

  if (options.loadGraph) {
    const seedSearchInput = document.getElementById('seedSearchInput') as HTMLInputElement;
    seedSearchInput.value = 'q';
    seedSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));

    const seedRow = document.getElementById('seedSearchResults')!.querySelector('.search-result-row') as HTMLElement;
    seedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  return { fetchMock, answerKeywordsCalls };
}

describe('回答モーダル(DOM実動作): 「キーワード一覧」ボタンのキャッシュ利用', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('グラフ読み込み済みの場合、キャッシュ(keywordCountMap/keywordCategoryMap)から出現回数・分類色付きバッジを表示し、/api/aichat/answer-keywordsへは問い合わせない', async () => {
    const { answerKeywordsCalls } = await setupKeywordListCacheTest({ loadGraph: true });

    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const btn = document.getElementById('answerModalKeywordListBtn') as HTMLButtonElement;
    expect(btn.style.display).not.toBe('none');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(answerKeywordsCalls).toHaveLength(0);

    const prereqBackdrop = document.getElementById('prereqModalBackdrop')!;
    expect(prereqBackdrop.classList.contains('open')).toBe(true);
    const badges = Array.from(prereqBackdrop.querySelectorAll('.prereq-kw-badge'));
    expect(badges.map((b) => b.textContent)).toEqual(['東京駅 (5)', '新幹線']);
    expect((badges[0] as HTMLElement).style.borderColor).not.toBe('');
    expect((badges[1] as HTMLElement).style.borderColor).toBe('');

    // 出現回数0件(未登録)のキーワードがあるため一括登録ボタンの行が表示される
    const foot = document.getElementById('prereqModalFoot')!;
    expect(foot.style.display).not.toBe('none');
  });

  it('グラフ未読み込みの場合はキャッシュが使えないため、従来通り/api/aichat/answer-keywordsへ問い合わせる', async () => {
    const { answerKeywordsCalls } = await setupKeywordListCacheTest({ loadGraph: false });

    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const btn = document.getElementById('answerModalKeywordListBtn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(answerKeywordsCalls).toHaveLength(1);
    const badges = Array.from(document.getElementById('prereqModalBackdrop')!.querySelectorAll('.prereq-kw-badge'));
    expect(badges.map((b) => b.textContent)).toEqual(['東京駅 (999)']);
  });
});
