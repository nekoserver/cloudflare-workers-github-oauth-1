// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページの「パン屑リスト(選択履歴の足跡)」機能
// (SPEC.cloudflare-workers-github-oauth-1.ANSWER-GRAPH.md 4.1)。中分類
// カテゴリ・「この回答文のキーワード:」バー・🧭絞り込みモーダルからの
// キーワード選択(2.→6.のループ)と、検索結果行の選択(起点確定・以後の
// フォーカス移動)のたびに足跡を#selectionTrailBarへ積み、足跡をタップすると
// その時点まで巻き戻して再検索/再読み込みする。手入力検索はループ外の
// 操作のため足跡をリセットする。
//
// 故障シナリオ:
//   (1) キーワード選択・行選択をしても足跡が記録されない、または足跡が
//       積まれるたびに古い足跡が消えてしまう
//   (2) 足跡をタップしても巻き戻らない、またはそれ以降の足跡が残ったまま
//       になる(computeTrailAfterJumpが末尾を正しく切り詰めない)
//   (3) 手入力検索をしても足跡がリセットされず、直前のループの足跡と
//       混ざってしまう
//   (4) 足跡が0件のときにバーが表示されたままになる、非表示に戻らない

function buildPage(): string {
  return getAnswerGraphPage('testuser', {}, false);
}

function loadPureFns() {
  const html = buildPage();
  const idx = html.indexOf('function computeTrailAfterJump');
  const endIdx = html.indexOf('function doSeedSearch');
  expect(idx).toBeGreaterThan(-1);
  expect(endIdx).toBeGreaterThan(idx);
  const src = html.slice(idx, endIdx);
  const fn = new Function(`${src}\nreturn { computeTrailAfterJump: computeTrailAfterJump };`);
  return fn() as {
    computeTrailAfterJump: (trail: Array<{ type: string; label: string }>, index: number) => Array<{ type: string; label: string }>;
  };
}

const sampleTrail = [
  { type: 'keyword', label: 'kw-a' },
  { type: 'seed', label: 'Q1', id: 's1' },
  { type: 'keyword', label: 'kw-b' },
  { type: 'keyword', label: 'kw-c' },
];

describe('computeTrailAfterJump: パン屑の巻き戻し', () => {
  it('指定indexまでの足跡を残し、それ以降は破棄する', () => {
    const { computeTrailAfterJump } = loadPureFns();
    expect(computeTrailAfterJump(sampleTrail, 1).map((e) => e.label)).toEqual(['kw-a', 'Q1']);
  });

  it('index=0を指定すると先頭の1件だけが残る', () => {
    const { computeTrailAfterJump } = loadPureFns();
    expect(computeTrailAfterJump(sampleTrail, 0).map((e) => e.label)).toEqual(['kw-a']);
  });

  it('最後のindexを指定すると全件残る', () => {
    const { computeTrailAfterJump } = loadPureFns();
    expect(computeTrailAfterJump(sampleTrail, 3).map((e) => e.label)).toEqual(['kw-a', 'Q1', 'kw-b', 'kw-c']);
  });

  it('元の配列を破壊しない', () => {
    const { computeTrailAfterJump } = loadPureFns();
    const before = sampleTrail.length;
    computeTrailAfterJump(sampleTrail, 1);
    expect(sampleTrail.length).toBe(before);
  });
});

async function setupTrailTest() {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });

  // a:seed -(k:a)-> a:mid -(k:x)-> a:end
  const graphNodes = [
    { id: 'a:seed', type: 'answer', label: 'seed', depth: 0 },
    { id: 'k:a', type: 'keyword', label: 'kw-a', depth: 1 },
    { id: 'a:mid', type: 'answer', label: 'mid', depth: 2 },
    { id: 'k:x', type: 'keyword', label: 'kw-x', depth: 3 },
    { id: 'a:end', type: 'answer', label: 'end', depth: 4 },
  ];
  const graphEdges = [
    { from: 'a:seed', to: 'k:a' },
    { from: 'k:a', to: 'a:mid' },
    { from: 'a:mid', to: 'k:x' },
    { from: 'k:x', to: 'a:end' },
  ];
  const firstSearchResults = [
    { id: 'seed', question: '質問1(起点)', created_at: '2026-01-01T00:00:00.000Z', keywordCount: 1 },
  ];
  const midSearchResults = [
    { id: 'mid', question: '質問2(kw-aで再検索)', created_at: '2026-01-02T00:00:00.000Z', keywordCount: 1 },
  ];
  let searchCallCount = 0;
  const fetchMock = vi.fn((url: string) => {
    const u = String(url);
    if (u.includes('/api/aichat/shares/search')) {
      searchCallCount++;
      const results = searchCallCount === 1 ? firstSearchResults : midSearchResults;
      return Promise.resolve({ json: () => Promise.resolve({ results }) });
    }
    if (u.includes('/api/aichat/answer-propagation-graph')) {
      return Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify({ nodes: graphNodes, edges: graphEdges })) });
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

  return {
    seedSearchInput,
    seedSearchResults: document.getElementById('seedSearchResults')!,
    answerKeywordsBar: document.getElementById('answerKeywordsBar')!,
    selectionTrailBar: document.getElementById('selectionTrailBar')!,
  };
}

function trailChipTexts(selectionTrailBar: HTMLElement) {
  return Array.from(selectionTrailBar.querySelectorAll('.trail-chip')).map((el) => el.textContent);
}

describe('パン屑リスト(#selectionTrailBar): DOM実動作', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('何も選んでいない状態ではバーが非表示', async () => {
    const { selectionTrailBar } = await setupTrailTest();
    expect(selectionTrailBar.classList.contains('visible')).toBe(false);
    expect(trailChipTexts(selectionTrailBar)).toEqual([]);
  });

  it('検索結果行(起点)を選ぶと足跡に📄付きで積まれる', async () => {
    const { seedSearchResults, selectionTrailBar } = await setupTrailTest();
    const seedRow = seedSearchResults.querySelector('.search-result-row') as HTMLElement;
    seedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(selectionTrailBar.classList.contains('visible')).toBe(true);
    expect(trailChipTexts(selectionTrailBar)).toEqual(['📄 質問1(起点)']);
  });

  it('続けてキーワードバーのチップを選ぶと足跡が積み上がる', async () => {
    const { seedSearchResults, answerKeywordsBar, selectionTrailBar } = await setupTrailTest();
    const seedRow = seedSearchResults.querySelector('.search-result-row') as HTMLElement;
    seedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const chip = answerKeywordsBar.querySelector('.answer-keyword-chip') as HTMLElement;
    chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(trailChipTexts(selectionTrailBar)).toEqual(['📄 質問1(起点)', 'kw-a']);
  });

  it('足跡をタップすると、その時点まで巻き戻り以降の足跡が消える', async () => {
    const { seedSearchResults, answerKeywordsBar, selectionTrailBar, seedSearchInput } = await setupTrailTest();
    const seedRow = seedSearchResults.querySelector('.search-result-row') as HTMLElement;
    seedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const chip = answerKeywordsBar.querySelector('.answer-keyword-chip') as HTMLElement;
    chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(trailChipTexts(selectionTrailBar)).toEqual(['📄 質問1(起点)', 'kw-a']);

    // 先頭の足跡(起点)をタップして巻き戻す
    const firstChip = selectionTrailBar.querySelectorAll('.trail-chip')[0] as HTMLElement;
    firstChip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(trailChipTexts(selectionTrailBar)).toEqual(['📄 質問1(起点)']);
  });

  it('末尾(現在地)の足跡チップはクリックできない(disabled)', async () => {
    const { seedSearchResults, selectionTrailBar } = await setupTrailTest();
    const seedRow = seedSearchResults.querySelector('.search-result-row') as HTMLElement;
    seedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const onlyChip = selectionTrailBar.querySelector('.trail-chip') as HTMLButtonElement;
    expect(onlyChip.disabled).toBe(true);
    expect(onlyChip.classList.contains('trail-chip-current')).toBe(true);
  });

  it('手入力で検索すると足跡がリセットされる', async () => {
    const { seedSearchResults, answerKeywordsBar, selectionTrailBar, seedSearchInput } = await setupTrailTest();
    const seedRow = seedSearchResults.querySelector('.search-result-row') as HTMLElement;
    seedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const chip = answerKeywordsBar.querySelector('.answer-keyword-chip') as HTMLElement;
    chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(trailChipTexts(selectionTrailBar).length).toBeGreaterThan(0);

    seedSearchInput.value = 'q2';
    seedSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(selectionTrailBar.classList.contains('visible')).toBe(false);
    expect(trailChipTexts(selectionTrailBar)).toEqual([]);
  });

  it('✕クリアボタンで足跡をリセットできる', async () => {
    const { seedSearchResults, selectionTrailBar } = await setupTrailTest();
    const seedRow = seedSearchResults.querySelector('.search-result-row') as HTMLElement;
    seedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(selectionTrailBar.classList.contains('visible')).toBe(true);

    const clearBtn = selectionTrailBar.querySelector('.trail-clear-btn') as HTMLElement;
    clearBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(selectionTrailBar.classList.contains('visible')).toBe(false);
    expect(trailChipTexts(selectionTrailBar)).toEqual([]);
  });
});
