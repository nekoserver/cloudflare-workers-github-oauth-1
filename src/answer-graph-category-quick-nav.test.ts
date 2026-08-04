// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページ(src/views/answerGraph.ts)の「起点にする回答を検索」
// 表記の直下に新設する、大分類/中分類からのキーワードすばやい絞り込みUI。
//
// 仕様:
//   - 大分類カテゴリをラジオボタンで横一列に列挙し、内包キーワード総数の多い順
//     に並べる。ラベルは「(件数) 大分類名」
//   - 大分類をひとつ選ぶと、その真下にその大分類に属する中分類カテゴリの
//     ドロップダウン(<select>)がキーワード総数の多い順で左から右に並ぶ
//   - 各中分類のドロップダウンは、そのカテゴリに属するキーワードをヒット件数
//     (cnt)の多い順で列挙する
//   - ドロップダウンでキーワードを選ぶと、その下の検索窓(seedSearchInput)に
//     選んだキーワードが埋め込まれ、検索が実行される
//
// 故障シナリオ:
//   (1) 大分類の並び順が内包キーワード総数の多い順になっていない
//   (2) 大分類選択後に表示される中分類ドロップダウンの並び順が
//       キーワード総数の多い順になっていない
//   (3) 中分類ドロップダウン内のキーワードがヒット件数順になっていない
//       (category_pairs と category_id の両方のケースを正しく扱えていない)
//   (4) ドロップダウンでキーワードを選んでも検索窓に反映されない、
//       または検索が実行されない
//   (5) 大分類を選び直しても前の中分類ドロップダウンが残ったままになる

function buildPage(): string {
  return getAnswerGraphPage('testuser', {});
}

function loadPureFns() {
  const html = buildPage();
  const idx = html.indexOf('function computeKeywordsByCategory');
  const endIdx = html.indexOf('function drawGraph');
  expect(idx).toBeGreaterThan(-1);
  expect(endIdx).toBeGreaterThan(idx);
  const src = html.slice(idx, endIdx);
  const fn = new Function(`${src}\nreturn { computeKeywordsByCategory: computeKeywordsByCategory, sortByKwCountDesc: sortByKwCountDesc };`);
  return fn() as {
    computeKeywordsByCategory: (keywords: Array<{ keyword: string; cnt: number; category_pairs?: string | null; category_id?: number | null }>) => Record<string, Array<{ keyword: string; cnt: number }>>;
    sortByKwCountDesc: (items: Array<{ kw_count?: number }>) => Array<{ kw_count?: number }>;
  };
}

describe('computeKeywordsByCategory: カテゴリごとのキーワードをヒット件数順に集計', () => {
  it('category_pairs(複数カテゴリ)からカテゴリごとに分類し、cnt降順で並べる', () => {
    const { computeKeywordsByCategory } = loadPureFns();
    const keywords = [
      { keyword: 'A', cnt: 3, category_pairs: '1:#111111,2:#222222' },
      { keyword: 'B', cnt: 10, category_pairs: '1:#111111' },
      { keyword: 'C', cnt: 5, category_pairs: '2:#222222' },
    ];
    const byCat = computeKeywordsByCategory(keywords);
    expect(byCat['1'].map((k) => k.keyword)).toEqual(['B', 'A']);
    expect(byCat['2'].map((k) => k.keyword)).toEqual(['C', 'A']);
  });

  it('category_id(単一カテゴリ)のみのレコードも扱える', () => {
    const { computeKeywordsByCategory } = loadPureFns();
    const keywords = [
      { keyword: 'X', cnt: 1, category_id: 5 },
      { keyword: 'Y', cnt: 9, category_id: 5 },
    ];
    const byCat = computeKeywordsByCategory(keywords);
    expect(byCat['5'].map((k) => k.keyword)).toEqual(['Y', 'X']);
  });

  it('未分類(category_pairs・category_idどちらも無い)キーワードはどのカテゴリにも含まれない', () => {
    const { computeKeywordsByCategory } = loadPureFns();
    const keywords = [{ keyword: 'Z', cnt: 1 }];
    const byCat = computeKeywordsByCategory(keywords);
    expect(Object.keys(byCat)).toEqual([]);
  });
});

describe('sortByKwCountDesc: kw_countの多い順ソート', () => {
  it('kw_countの降順に並べ替える(元配列は破壊しない)', () => {
    const { sortByKwCountDesc } = loadPureFns();
    const items = [{ kw_count: 3 }, { kw_count: 9 }, { kw_count: 1 }];
    const sorted = sortByKwCountDesc(items);
    expect(sorted.map((i) => i.kw_count)).toEqual([9, 3, 1]);
    expect(items.map((i) => i.kw_count)).toEqual([3, 9, 1]);
  });

  it('kw_countが無い要素は0として扱う', () => {
    const { sortByKwCountDesc } = loadPureFns();
    const items = [{ kw_count: 2 }, {}];
    const sorted = sortByKwCountDesc(items);
    expect(sorted[0].kw_count).toBe(2);
  });
});

describe('/answer-graph ページのHTML構造: カテゴリ絞り込みUIが検索窓の上に存在する', () => {
  it('catQuickGroups/catQuickCatsが「起点にする回答を検索」の直下、検索窓(search-row)より上に配置される', () => {
    const html = buildPage();
    const titleIdx = html.indexOf('起点にする回答を検索');
    const groupsIdx = html.indexOf('id="catQuickGroups"');
    const catsIdx = html.indexOf('id="catQuickCats"');
    const searchRowIdx = html.indexOf('class="search-row"');
    expect(titleIdx).toBeGreaterThan(-1);
    expect(groupsIdx).toBeGreaterThan(titleIdx);
    expect(catsIdx).toBeGreaterThan(groupsIdx);
    expect(searchRowIdx).toBeGreaterThan(catsIdx);
  });
});

async function setupCatQuickNav() {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });

  const groups = [
    { id: 'g1', group_name: '技術グループ', category_ids: [1, 2], kw_count: 8 },
    { id: 'g2', group_name: '生活グループ', category_ids: [3], kw_count: 20 },
  ];
  const categories = [
    { id: 1, name: 'フレームワーク', color: '#111111', kw_count: 5 },
    { id: 2, name: 'インフラ', color: '#222222', kw_count: 3 },
    { id: 3, name: '料理', color: '#333333', kw_count: 20 },
  ];
  const keywords = [
    { keyword: 'Hono', cnt: 4, category_pairs: '1:#111111' },
    { keyword: 'Express', cnt: 1, category_pairs: '1:#111111' },
    { keyword: 'Docker', cnt: 3, category_pairs: '2:#222222' },
    { keyword: 'カレー', cnt: 9, category_pairs: '3:#333333' },
  ];

  const fetchMock = vi.fn((url: string) => {
    const u = String(url);
    if (u.includes('/api/aichat/category-groups')) {
      return Promise.resolve({ json: () => Promise.resolve({ groups }) });
    }
    if (u.includes('/api/aichat/keyword-categories-summary')) {
      return Promise.resolve({ json: () => Promise.resolve({ categories }) });
    }
    if (u.includes('/api/aichat/all-keywords')) {
      return Promise.resolve({ json: () => Promise.resolve({ keywords }) });
    }
    if (u.includes('/api/aichat/shares/search')) {
      return Promise.resolve({ json: () => Promise.resolve({ results: [] }) });
    }
    return Promise.resolve({ json: () => Promise.resolve({}) });
  });
  vi.stubGlobal('fetch', fetchMock);

  const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();

  await new Promise((resolve) => setTimeout(resolve, 10));

  return {
    catQuickGroups: document.getElementById('catQuickGroups')!,
    catQuickCats: document.getElementById('catQuickCats')!,
    seedSearchInput: document.getElementById('seedSearchInput') as HTMLInputElement,
    fetchMock,
  };
}

describe('カテゴリ絞り込みUIのDOM実動作(jsdom)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('大分類ラジオボタンが内包キーワード総数の多い順(降順)に並ぶ', async () => {
    const { catQuickGroups } = await setupCatQuickNav();
    const labels = Array.from(catQuickGroups.querySelectorAll('.cat-quick-group-label')).map((el) => el.textContent);
    expect(labels).toEqual(['(20) 生活グループ', '(8) 技術グループ']);
  });

  it('ラジオボタンは1つのname属性を共有し1つしか選択できない', async () => {
    const { catQuickGroups } = await setupCatQuickNav();
    const radios = Array.from(catQuickGroups.querySelectorAll('input[type=radio]')) as HTMLInputElement[];
    expect(radios.length).toBe(2);
    expect(radios[0].name).toBe(radios[1].name);
  });

  it('大分類を選ぶとその中分類のドロップダウンがキーワード総数の多い順(左から右)に並ぶ', async () => {
    const { catQuickGroups, catQuickCats } = await setupCatQuickNav();
    const radios = Array.from(catQuickGroups.querySelectorAll('input[type=radio]')) as HTMLInputElement[];
    // 技術グループ(kw_count=8)を選択
    const techRadio = radios.find((r) => r.value === 'g1')!;
    techRadio.checked = true;
    techRadio.dispatchEvent(new Event('change', { bubbles: true }));

    const selects = Array.from(catQuickCats.querySelectorAll('select.cat-quick-cat-select')) as unknown as HTMLSelectElement[];
    expect(selects.length).toBe(2);
    // フレームワーク(kw_count=5) が インフラ(kw_count=3) より先
    expect(selects[0].options[0].textContent).toBe('フレームワーク (5)');
    expect(selects[1].options[0].textContent).toBe('インフラ (3)');
  });

  it('中分類ドロップダウン内のキーワードはヒット件数(cnt)の多い順に列挙される', async () => {
    const { catQuickGroups, catQuickCats } = await setupCatQuickNav();
    const radios = Array.from(catQuickGroups.querySelectorAll('input[type=radio]')) as HTMLInputElement[];
    const techRadio = radios.find((r) => r.value === 'g1')!;
    techRadio.checked = true;
    techRadio.dispatchEvent(new Event('change', { bubbles: true }));

    const frameworkSelect = (Array.from(catQuickCats.querySelectorAll('select.cat-quick-cat-select')) as unknown as HTMLSelectElement[])[0];
    const keywordOptions = Array.from(frameworkSelect.options).slice(1).map((o) => o.value);
    expect(keywordOptions).toEqual(['Hono', 'Express']);
  });

  it('ドロップダウンでキーワードを選ぶと検索窓に埋め込まれ検索が実行される', async () => {
    const { catQuickGroups, catQuickCats, seedSearchInput, fetchMock } = await setupCatQuickNav();
    const radios = Array.from(catQuickGroups.querySelectorAll('input[type=radio]')) as HTMLInputElement[];
    const techRadio = radios.find((r) => r.value === 'g1')!;
    techRadio.checked = true;
    techRadio.dispatchEvent(new Event('change', { bubbles: true }));

    const frameworkSelect = (Array.from(catQuickCats.querySelectorAll('select.cat-quick-cat-select')) as unknown as HTMLSelectElement[])[0];
    frameworkSelect.value = 'Hono';
    frameworkSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(seedSearchInput.value).toBe('Hono');
    await new Promise((resolve) => setTimeout(resolve, 10));
    const searchCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/aichat/shares/search'));
    expect(searchCalls.some((c) => String(c[0]).includes(encodeURIComponent('Hono')))).toBe(true);
  });

  it('大分類を選び直すと前の中分類ドロップダウンは残らない', async () => {
    const { catQuickGroups, catQuickCats } = await setupCatQuickNav();
    const radios = Array.from(catQuickGroups.querySelectorAll('input[type=radio]')) as HTMLInputElement[];
    const techRadio = radios.find((r) => r.value === 'g1')!;
    techRadio.checked = true;
    techRadio.dispatchEvent(new Event('change', { bubbles: true }));
    expect(catQuickCats.querySelectorAll('select.cat-quick-cat-select').length).toBe(2);

    const lifeRadio = radios.find((r) => r.value === 'g2')!;
    lifeRadio.checked = true;
    lifeRadio.dispatchEvent(new Event('change', { bubbles: true }));

    const selects = Array.from(catQuickCats.querySelectorAll('select.cat-quick-cat-select')) as unknown as HTMLSelectElement[];
    expect(selects.length).toBe(1);
    expect(selects[0].options[0].textContent).toBe('料理 (20)');
  });
});
