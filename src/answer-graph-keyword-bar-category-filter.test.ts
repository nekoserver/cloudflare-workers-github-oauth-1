// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページの「この回答文のキーワード:」バー
// (#answerKeywordsBar)。以下の3点を検証する。
//   1. キーワードは出現回数(AIチャットページでのkeywordCountMap)の多い順に
//      左詰めで並ぶ
//   2. 各キーワードチップは属する中分類カテゴリの色で枠を色分けする
//   3. 表示中のキーワードが属する中分類カテゴリごとにチェックボックスが
//      並び(デフォルト全てON)、OFFにするとそのカテゴリのキーワードだけが
//      非表示になる
//
// 故障シナリオ:
//   (1) キーワードの並び順が出現回数と無関係(バニラのbearing順のまま)
//   (2) 枠色がカテゴリ色を反映しない、または全キーワードが同じ色になる
//   (3) カテゴリのチェックボックスが表示されない、またはデフォルトでOFFに
//       なっている
//   (4) チェックボックスをOFFにしても対象カテゴリのキーワードが消えない、
//       または無関係なカテゴリのキーワードまで消えてしまう
//   (5) 中分類カテゴリに属さないキーワードが、フィルタ操作で意図せず
//       消えてしまう

function buildPage(): string {
  return getAnswerGraphPage('testuser', {}, false);
}

function loadPureFns() {
  const html = buildPage();
  const idx = html.indexOf('function sortKeywordSlotsByCountDesc');
  const endIdx = html.indexOf('function renderAnswerKeywordsBar');
  expect(idx).toBeGreaterThan(-1);
  expect(endIdx).toBeGreaterThan(idx);
  const src = html.slice(idx, endIdx);
  const fn = new Function(`${src}\nreturn { sortKeywordSlotsByCountDesc: sortKeywordSlotsByCountDesc, computeVisibleKeywordSlots: computeVisibleKeywordSlots };`);
  return fn() as {
    sortKeywordSlotsByCountDesc: (slots: Array<{ node: { label: string } }>, countMap: Record<string, number>) => Array<{ node: { label: string } }>;
    computeVisibleKeywordSlots: (slots: Array<{ node: { label: string } }>, categoryMap: Record<string, string>, categoryFilter: Record<string, boolean>) => Array<{ node: { label: string } }>;
  };
}

describe('sortKeywordSlotsByCountDesc: 出現回数の多い順に並べ替える', () => {
  const slots = [
    { node: { label: 'kw-b' } },
    { node: { label: 'kw-a' } },
    { node: { label: 'kw-c' } },
  ];
  const countMap = { 'kw-a': 5, 'kw-b': 20, 'kw-c': 1 };

  it('出現回数の多い順に並ぶ', () => {
    const { sortKeywordSlotsByCountDesc } = loadPureFns();
    const sorted = sortKeywordSlotsByCountDesc(slots, countMap);
    expect(sorted.map((s) => s.node.label)).toEqual(['kw-b', 'kw-a', 'kw-c']);
  });

  it('countMapに無いキーワードは0件として扱われ末尾に並ぶ', () => {
    const { sortKeywordSlotsByCountDesc } = loadPureFns();
    const sorted = sortKeywordSlotsByCountDesc(slots, { 'kw-b': 20 });
    expect(sorted.map((s) => s.node.label)).toEqual(['kw-b', 'kw-a', 'kw-c']);
  });

  it('元の配列を破壊しない', () => {
    const { sortKeywordSlotsByCountDesc } = loadPureFns();
    const before = slots.map((s) => s.node.label);
    sortKeywordSlotsByCountDesc(slots, countMap);
    expect(slots.map((s) => s.node.label)).toEqual(before);
  });
});

describe('computeVisibleKeywordSlots: 中分類カテゴリのフィルタで表示するキーワードを絞り込む', () => {
  const slots = [
    { node: { label: 'kw-cat1' } },
    { node: { label: 'kw-cat2' } },
    { node: { label: 'kw-no-cat' } },
  ];
  const categoryMap = { 'kw-cat1': 'c1', 'kw-cat2': 'c2' };

  it('全カテゴリONなら全て表示される', () => {
    const { computeVisibleKeywordSlots } = loadPureFns();
    const visible = computeVisibleKeywordSlots(slots, categoryMap, { c1: true, c2: true });
    expect(visible.map((s) => s.node.label)).toEqual(['kw-cat1', 'kw-cat2', 'kw-no-cat']);
  });

  it('特定カテゴリをOFFにすると、そのカテゴリのキーワードだけ除外される', () => {
    const { computeVisibleKeywordSlots } = loadPureFns();
    const visible = computeVisibleKeywordSlots(slots, categoryMap, { c1: false, c2: true });
    expect(visible.map((s) => s.node.label)).toEqual(['kw-cat2', 'kw-no-cat']);
  });

  it('カテゴリに属さないキーワードは、他カテゴリの状態に関わらず常に表示される', () => {
    const { computeVisibleKeywordSlots } = loadPureFns();
    const visible = computeVisibleKeywordSlots(slots, categoryMap, { c1: false, c2: false });
    expect(visible.map((s) => s.node.label)).toEqual(['kw-no-cat']);
  });
});

async function setupKeywordBarCategoryTest() {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });

  // a:seed -(k:travel-kw, k:code-kw, k:no-cat-kw)-> a:mid(各)
  const graphNodes = [
    { id: 'a:seed', type: 'answer', label: 'seed', depth: 0 },
    { id: 'k:旅行語', type: 'keyword', label: '旅行語', depth: 1 },
    { id: 'k:コード語', type: 'keyword', label: 'コード語', depth: 1 },
    { id: 'k:無所属語', type: 'keyword', label: '無所属語', depth: 1 },
    { id: 'a:mid', type: 'answer', label: 'mid', depth: 2 },
  ];
  const graphEdges = [
    { from: 'a:seed', to: 'k:旅行語' },
    { from: 'a:seed', to: 'k:コード語' },
    { from: 'a:seed', to: 'k:無所属語' },
    { from: 'k:旅行語', to: 'a:mid' },
  ];
  const searchResults = [
    { id: 'seed', question: '質問1(起点)', created_at: '2026-01-01T00:00:00.000Z', keywordCount: 3 },
  ];
  const fetchMock = vi.fn((url: string) => {
    const u = String(url);
    if (u.includes('/api/aichat/shares/search')) {
      return Promise.resolve({ json: () => Promise.resolve({ results: searchResults }) });
    }
    if (u.includes('/api/aichat/answer-propagation-graph')) {
      return Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify({ nodes: graphNodes, edges: graphEdges })) });
    }
    if (u.includes('/api/aichat/category-groups')) {
      return Promise.resolve({ json: () => Promise.resolve({ groups: [] }) });
    }
    if (u.includes('/api/aichat/keyword-categories-summary')) {
      return Promise.resolve({ json: () => Promise.resolve({ categories: [
        { id: 1, name: '旅行', color: '#38bdf8' },
        { id: 2, name: 'コーディング', color: '#86efac' },
      ] }) });
    }
    if (u.includes('/api/aichat/all-keywords')) {
      return Promise.resolve({ json: () => Promise.resolve({ keywords: [
        { keyword: '旅行語', cnt: 5, category_id: 1 },
        { keyword: 'コード語', cnt: 50, category_id: 2 },
        { keyword: '無所属語', cnt: 1 },
      ] }) });
    }
    return Promise.resolve({ json: () => Promise.resolve({}) });
  });
  vi.stubGlobal('fetch', fetchMock);

  const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();

  // loadCatQuickNav()のカテゴリ/出現回数取得を待つ
  await new Promise((resolve) => setTimeout(resolve, 20));

  const seedSearchInput = document.getElementById('seedSearchInput') as HTMLInputElement;
  seedSearchInput.value = 'q';
  seedSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 400));

  const seedSearchResults = document.getElementById('seedSearchResults')!;
  const seedRow = seedSearchResults.querySelector('.search-result-row') as HTMLElement;
  seedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 20));

  return { answerKeywordsBar: document.getElementById('answerKeywordsBar')! };
}

describe('「この回答文のキーワード:」バー(DOM実動作): 出現回数順・カテゴリ色分け・カテゴリフィルタ', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('キーワードは出現回数の多い順(左詰め)で並ぶ', async () => {
    const { answerKeywordsBar } = await setupKeywordBarCategoryTest();
    const chips = Array.from(answerKeywordsBar.querySelectorAll('.answer-keyword-chip'));
    const labels = chips.map((c) => c.textContent);
    expect(labels[0]).toContain('コード語');
    expect(labels[1]).toContain('旅行語');
    expect(labels[2]).toContain('無所属語');
  });

  it('各キーワードチップは所属カテゴリの色で枠が色分けされ、無所属のキーワードは色指定されない', async () => {
    const { answerKeywordsBar } = await setupKeywordBarCategoryTest();
    const chips = Array.from(answerKeywordsBar.querySelectorAll('.answer-keyword-chip')) as HTMLElement[];
    const codeChip = chips.find((c) => c.textContent!.indexOf('コード語') !== -1)!;
    const travelChip = chips.find((c) => c.textContent!.indexOf('旅行語') !== -1)!;
    const noCatChip = chips.find((c) => c.textContent!.indexOf('無所属語') !== -1)!;
    expect(codeChip.style.borderColor).not.toBe('');
    expect(travelChip.style.borderColor).not.toBe('');
    expect(codeChip.style.borderColor).not.toBe(travelChip.style.borderColor);
    expect(noCatChip.style.borderColor).toBe('');
  });

  it('表示中のキーワードが属するカテゴリごとにチェックボックスが並び、デフォルトで全てONになっている', async () => {
    const { answerKeywordsBar } = await setupKeywordBarCategoryTest();
    const checkboxes = Array.from(answerKeywordsBar.querySelectorAll('.answer-keywords-cat-filter-item input[type=checkbox]')) as HTMLInputElement[];
    expect(checkboxes.length).toBe(2);
    expect(checkboxes.every((cb) => cb.checked)).toBe(true);
    const filterLabels = Array.from(answerKeywordsBar.querySelectorAll('.answer-keywords-cat-filter-item')).map((el) => el.textContent);
    expect(filterLabels.some((t) => t!.indexOf('旅行') !== -1)).toBe(true);
    expect(filterLabels.some((t) => t!.indexOf('コーディング') !== -1)).toBe(true);
  });

  it('カテゴリのチェックボックスをOFFにすると、そのカテゴリのキーワードだけ非表示になる(無所属は残る)', async () => {
    const { answerKeywordsBar } = await setupKeywordBarCategoryTest();
    const travelCheckbox = Array.from(answerKeywordsBar.querySelectorAll('.answer-keywords-cat-filter-item'))
      .find((el) => el.textContent!.indexOf('旅行') !== -1)!
      .querySelector('input[type=checkbox]') as HTMLInputElement;
    travelCheckbox.checked = false;
    travelCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

    const labels = Array.from(answerKeywordsBar.querySelectorAll('.answer-keyword-chip')).map((c) => c.textContent);
    expect(labels.some((t) => t!.indexOf('旅行語') !== -1)).toBe(false);
    expect(labels.some((t) => t!.indexOf('コード語') !== -1)).toBe(true);
    expect(labels.some((t) => t!.indexOf('無所属語') !== -1)).toBe(true);
  });
});
