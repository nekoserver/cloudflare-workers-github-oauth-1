// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページのパン屑リスト(選択履歴の足跡)を、設定で
// 明示的に同意した場合のみブラウザのsessionStorageへ保存し、リロード後も
// 復元する機能(SPEC.cloudflare-workers-github-oauth-1.ANSWER-GRAPH.md 4.1)。
// 足跡には検索履歴・回答内容に由来する情報が含まれるため、デフォルトでは
// 一切書き込んではならない。
//
// 故障シナリオ:
//   (1) 設定がOFF(デフォルト)なのに足跡がsessionStorageへ書き込まれて
//       しまう(同意なき保存)
//   (2) 設定がONなのに足跡がsessionStorageへ保存されない、またはリロード後
//       (=スクリプト再実行後)に復元されない
//   (3) 設定をOFFにしても、過去に書き込まれたデータがsessionStorageに
//       残ったままになる(同意の取り消しが尊重されない)

const TRAIL_KEY = 'answerGraphSelectionTrail';

function buildPage(trailSessionStorageDefault?: boolean): string {
  return getAnswerGraphPage('testuser', {}, false, trailSessionStorageDefault);
}

function stubBaseFetchAndCanvas(html: string, firstSearchResults: Array<{ id: string; question: string; created_at: string; keywordCount: number }>) {
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });
  const fetchMock = vi.fn((url: string) => {
    const u = String(url);
    if (u.includes('/api/aichat/shares/search')) {
      return Promise.resolve({ json: () => Promise.resolve({ results: firstSearchResults }) });
    }
    if (u.includes('/api/aichat/answer-propagation-graph')) {
      return Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify({ nodes: [], edges: [] })) });
    }
    return Promise.resolve({ json: () => Promise.resolve({}) });
  });
  vi.stubGlobal('fetch', fetchMock);
}

async function setupTrailStorageTest(trailSessionStorageDefault?: boolean) {
  const html = buildPage(trailSessionStorageDefault);
  const firstSearchResults = [
    { id: 'seed', question: '質問1(起点)', created_at: '2026-01-01T00:00:00.000Z', keywordCount: 1 },
  ];
  stubBaseFetchAndCanvas(html, firstSearchResults);

  const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();

  await new Promise((resolve) => setTimeout(resolve, 10));

  const seedSearchInput = document.getElementById('seedSearchInput') as HTMLInputElement;
  seedSearchInput.value = 'q';
  seedSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 400));

  return { seedSearchResults: document.getElementById('seedSearchResults')! };
}

// 復元の検証だけを行うセットアップ。手入力検索(input イベント)は
// 足跡をリセットする操作のため、復元直後の状態を見たいこのテストでは
// 発火させない(スクリプトの初期化=リロード直後の状態を再現する)。
async function setupTrailStorageRestoreOnly(trailSessionStorageDefault?: boolean) {
  const html = buildPage(trailSessionStorageDefault);
  stubBaseFetchAndCanvas(html, []);

  const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();

  await new Promise((resolve) => setTimeout(resolve, 10));
}

describe('パン屑リストのsessionStorage保存(同意ベース・デフォルトOFF)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('設定がデフォルト(OFF)のとき、足跡を積んでもsessionStorageに書き込まれない', async () => {
    const { seedSearchResults } = await setupTrailStorageTest();
    const seedRow = seedSearchResults.querySelector('.search-result-row') as HTMLElement;
    seedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(sessionStorage.getItem(TRAIL_KEY)).toBeNull();
  });

  it('設定がONのとき、足跡を積むとsessionStorageに保存される', async () => {
    const { seedSearchResults } = await setupTrailStorageTest(true);
    const seedRow = seedSearchResults.querySelector('.search-result-row') as HTMLElement;
    seedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const raw = sessionStorage.getItem(TRAIL_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed).toEqual([{ type: 'seed', label: '質問1(起点)', id: 'seed' }]);
  });

  it('設定がONのとき、次回のスクリプト実行(リロード相当)でsessionStorageから足跡が復元される', async () => {
    sessionStorage.setItem(TRAIL_KEY, JSON.stringify([{ type: 'keyword', label: 'kw-restored' }]));
    await setupTrailStorageRestoreOnly(true);

    const selectionTrailBar = document.getElementById('selectionTrailBar')!;
    expect(selectionTrailBar.classList.contains('visible')).toBe(true);
    const chips = Array.from(selectionTrailBar.querySelectorAll('.trail-chip')).map((el) => el.textContent);
    expect(chips).toEqual(['kw-restored']);
  });

  it('設定がOFFのとき、次回のスクリプト実行時に過去のsessionStorageデータが消去される(同意取り消しの尊重)', async () => {
    sessionStorage.setItem(TRAIL_KEY, JSON.stringify([{ type: 'keyword', label: 'kw-old' }]));
    await setupTrailStorageRestoreOnly(false);

    expect(sessionStorage.getItem(TRAIL_KEY)).toBeNull();
    const selectionTrailBar = document.getElementById('selectionTrailBar')!;
    expect(selectionTrailBar.classList.contains('visible')).toBe(false);
  });
});
