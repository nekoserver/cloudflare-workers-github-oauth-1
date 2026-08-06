// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページ(src/views/answerGraph.ts)の起点検索結果テーブル。
// 各行の先頭にキーワード総数と質問日時を表示し、作表後(検索完了後)は
// キーワード数の多い順に並べる。「キーワード数」th をタップすると多い順/
// 少ない順/日時順の3状態で並べ替わり、他のカラム(日時・質問文)も行単位で
// 一緒に並べ替わる。
//
// キーワード数0・経路「ー」の行を非表示にする設定(answerGraphHideEmptyRows)
// はこのテストの対象外のため、buildPageでは明示的に無効化し、ソート挙動
// そのものだけを検証する。
//
// 故障シナリオ:
//   (1) 作表後の既定の並び順がキーワード数の多い順になっていない
//   (2) th クリックで並べ替えても行が入れ替わらない、または一方向にしか
//       ソートできない(多い順/少ない順/日時順を巡回しない)
//   (3) ソート後に「キーワード数」列だけ並び替わり、質問日時・質問文列が
//       元の行と対応しなくなる(行単位でのソートになっていない)
//   (4) キーワード総数・質問日時が行の先頭に表示されない
//   (5) 左2カラム(キーワード数・質問日時)が内容以上の横幅を取り、質問文の
//       表示幅を圧迫する(width:1% + nowrap のshrink-to-fitが外れている)

function buildPage(): string {
  return getAnswerGraphPage('testuser', {}, false);
}

function loadPureFns() {
  const html = buildPage();
  const idx = html.indexOf('function sortSearchResults');
  const endIdx = html.indexOf('function updateSearchSortIndicator');
  expect(idx).toBeGreaterThan(-1);
  expect(endIdx).toBeGreaterThan(idx);
  const src = html.slice(idx, endIdx);
  const fn = new Function(`${src}\nreturn { sortSearchResults: sortSearchResults, formatSearchResultDateTime: formatSearchResultDateTime };`);
  return fn() as {
    sortSearchResults: (results: Array<{ id: string; keywordCount: number; created_at: string }>, mode: string) => Array<{ id: string }>;
    formatSearchResultDateTime: (iso: string) => string;
  };
}

const sampleResults = [
  { id: 's1', question: 'Q1', created_at: '2026-01-01T00:00:00.000Z', keywordCount: 2 },
  { id: 's2', question: 'Q2', created_at: '2026-03-01T00:00:00.000Z', keywordCount: 5 },
  { id: 's3', question: 'Q3', created_at: '2026-02-01T00:00:00.000Z', keywordCount: 0 },
];

describe('sortSearchResults: 検索結果の並べ替え', () => {
  it("mode='date'では質問日時の新しい順(降順)に並ぶ", () => {
    const { sortSearchResults } = loadPureFns();
    const sorted = sortSearchResults(sampleResults, 'date');
    expect(sorted.map((r) => r.id)).toEqual(['s2', 's3', 's1']);
  });

  it("mode='count-desc'ではキーワード総数の多い順に並ぶ", () => {
    const { sortSearchResults } = loadPureFns();
    const sorted = sortSearchResults(sampleResults, 'count-desc');
    expect(sorted.map((r) => r.id)).toEqual(['s2', 's1', 's3']);
  });

  it("mode='count-asc'ではキーワード総数の少ない順に並ぶ", () => {
    const { sortSearchResults } = loadPureFns();
    const sorted = sortSearchResults(sampleResults, 'count-asc');
    expect(sorted.map((r) => r.id)).toEqual(['s3', 's1', 's2']);
  });

  it("mode='date-asc'では質問日時の古い順(昇順)に並ぶ", () => {
    const { sortSearchResults } = loadPureFns();
    const sorted = sortSearchResults(sampleResults, 'date-asc');
    expect(sorted.map((r) => r.id)).toEqual(['s1', 's3', 's2']);
  });

  it('元の配列を破壊しない', () => {
    const { sortSearchResults } = loadPureFns();
    const original = sampleResults.map((r) => r.id);
    sortSearchResults(sampleResults, 'count-desc');
    expect(sampleResults.map((r) => r.id)).toEqual(original);
  });
});

describe('formatSearchResultDateTime: 質問日時の表示整形', () => {
  it('ISO日時をYYYY/MM/DD HH:MM形式に整形する', () => {
    const { formatSearchResultDateTime } = loadPureFns();
    expect(formatSearchResultDateTime('2026-03-05T09:07:00.000Z')).toMatch(/^2026\/03\/05 \d{2}:\d{2}$/);
  });

  it('不正な日時文字列はそのまま返す', () => {
    const { formatSearchResultDateTime } = loadPureFns();
    expect(formatSearchResultDateTime('invalid')).toBe('invalid');
  });
});

async function setupSearchResultsTable() {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });

  const searchResults = [
    { id: 's1', question: '質問1', created_at: '2026-01-01T00:00:00.000Z', keywordCount: 2 },
    { id: 's2', question: '質問2', created_at: '2026-03-01T00:00:00.000Z', keywordCount: 5 },
    { id: 's3', question: '質問3', created_at: '2026-02-01T00:00:00.000Z', keywordCount: 0 },
  ];
  const fetchMock = vi.fn((url: string) => {
    if (String(url).includes('/api/aichat/shares/search')) {
      return Promise.resolve({ json: () => Promise.resolve({ results: searchResults }) });
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
    searchKeywordCountTh: document.getElementById('searchKeywordCountTh')!,
    searchDateTh: document.getElementById('searchDateTh')!,
    seedSearchResults: document.getElementById('seedSearchResults')!,
  };
}

describe('検索結果テーブルのCSS: 左2カラムのshrink-to-fit', () => {
  it('キーワード数・質問日時のtd/thはwidth:1%とnowrapで内容幅まで切り詰められている', () => {
    const html = buildPage();
    const countRuleIdx = html.indexOf('td.search-result-count');
    const countRule = html.slice(countRuleIdx, html.indexOf('}', countRuleIdx));
    expect(countRule).toContain('width:1%');
    expect(countRule).toContain('white-space:nowrap');

    const dateRuleIdx = html.indexOf('td.search-result-date');
    const dateRule = html.slice(dateRuleIdx, html.indexOf('}', dateRuleIdx));
    expect(dateRule).toContain('width:1%');
    expect(dateRule).toContain('white-space:nowrap');

    expect(html).toContain('.search-results-table th:nth-child(1), .search-results-table th:nth-child(2) { width:1%; }');
  });
});

describe('一人称モード以前: 起点検索結果テーブルのDOM実動作(jsdom)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('各行の先頭にキーワード総数、続いて質問日時、経路、その後に質問文が表示される', async () => {
    const { seedSearchResults } = await setupSearchResultsTable();
    const firstRow = seedSearchResults.querySelector('tr') as HTMLElement;
    const cells = Array.from(firstRow.children) as HTMLElement[];
    expect(cells[0].className).toBe('search-result-count');
    expect(cells[1].className).toBe('search-result-date');
    expect(cells[2].className).toBe('search-result-path');
    expect(cells[3].className).toBe('search-result-question');
  });

  it('作表後(検索完了後)はキーワード数の多い順に並ぶ', async () => {
    const { seedSearchResults } = await setupSearchResultsTable();
    const questions = Array.from(seedSearchResults.querySelectorAll('.search-result-question')).map((el) => el.textContent);
    expect(questions).toEqual(['質問2', '質問1', '質問3']);
  });

  it('「キーワード数」thをクリックすると少ない順→日時順→多い順の順に巡回し、他の列も行ごと一緒に並べ替わる', async () => {
    const { searchKeywordCountTh, seedSearchResults } = await setupSearchResultsTable();

    // 作表直後は既にキーワード数の多い順(count-desc)のため、1クリック目は少ない順になる
    searchKeywordCountTh.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    let rows = Array.from(seedSearchResults.querySelectorAll('tr'));
    let counts = rows.map((r) => r.querySelector('.search-result-count')!.textContent);
    let questions = rows.map((r) => r.querySelector('.search-result-question')!.textContent);
    expect(counts).toEqual(['0', '2', '5']);
    expect(questions).toEqual(['質問3', '質問1', '質問2']);

    searchKeywordCountTh.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    rows = Array.from(seedSearchResults.querySelectorAll('tr'));
    counts = rows.map((r) => r.querySelector('.search-result-count')!.textContent);
    questions = rows.map((r) => r.querySelector('.search-result-question')!.textContent);
    expect(counts).toEqual(['5', '0', '2']);
    expect(questions).toEqual(['質問2', '質問3', '質問1']);

    searchKeywordCountTh.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    questions = Array.from(seedSearchResults.querySelectorAll('.search-result-question')).map((el) => el.textContent);
    expect(questions).toEqual(['質問2', '質問1', '質問3']);
  });

  it('新しい検索を行うと並び順がキーワード数の多い順にリセットされる', async () => {
    const { searchKeywordCountTh } = await setupSearchResultsTable();
    searchKeywordCountTh.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const seedSearchInput = document.getElementById('seedSearchInput') as HTMLInputElement;
    seedSearchInput.value = 'q2';
    seedSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));

    const seedSearchResults = document.getElementById('seedSearchResults')!;
    const questions = Array.from(seedSearchResults.querySelectorAll('.search-result-question')).map((el) => el.textContent);
    expect(questions).toEqual(['質問2', '質問1', '質問3']);
  });

  it('「質問日時」thをクリックすると新しい順/古い順にトグルし、他の列も行ごと一緒に並べ替わる', async () => {
    const { searchDateTh, seedSearchResults } = await setupSearchResultsTable();

    searchDateTh.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    let questions = Array.from(seedSearchResults.querySelectorAll('.search-result-question')).map((el) => el.textContent);
    let counts = Array.from(seedSearchResults.querySelectorAll('.search-result-count')).map((el) => el.textContent);
    expect(questions).toEqual(['質問1', '質問3', '質問2']);
    expect(counts).toEqual(['2', '0', '5']);

    searchDateTh.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    questions = Array.from(seedSearchResults.querySelectorAll('.search-result-question')).map((el) => el.textContent);
    expect(questions).toEqual(['質問2', '質問3', '質問1']);
  });

  it('「質問日時」thをクリックしても「キーワード数」列のソート状態には影響しない(キーワード数thの表示は🔑のまま)', async () => {
    const { searchKeywordCountTh, searchDateTh } = await setupSearchResultsTable();
    searchDateTh.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(searchKeywordCountTh.textContent).toBe('🔑');
  });
});
