// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページのパン屑リスト(選択履歴の足跡)を、設定で
// 明示的に同意した場合のみブラウザのsessionStorageへ保存し、リロード後も
// 「人間が選んだ結果とその先の意思決定」を実際に再現する機能
// (SPEC.cloudflare-workers-github-oauth-1.ANSWER-GRAPH.md 4.1/4.2)。
// 足跡には検索履歴・回答内容に由来する情報が含まれるため、デフォルトでは
// 一切書き込んではならない。
//
// 単に足跡チップの見た目だけを復元しても、その先の意思決定(どの回答を
// 起点にしていたか・どんな検索結果/キーワード候補が見えていたか)を
// 補えなければ意味が無いため、replaySelectionTrail は足跡の各ステップを
// 記録順に再実行し、グラフ取得(loadGraph)・再検索(doSeedSearch)を経て
// 実際の選択状況(currentGraph・検索結果テーブル・回答文キーワードバー)
// まで再現する。
//
// 故障シナリオ:
//   (1) 設定がOFF(デフォルト)なのに足跡がsessionStorageへ書き込まれて
//       しまう(同意なき保存)
//   (2) 設定がONなのに足跡がsessionStorageへ保存されない、またはリロード後
//       (=スクリプト再実行後)に復元されない
//   (3) 設定をOFFにしても、過去に書き込まれたデータがsessionStorageに
//       残ったままになる(同意の取り消しが尊重されない)
//   (4) 足跡チップの見た目だけが復元され、グラフ取得・検索結果・
//       キーワードバーといった実際の選択状況が再現されない(復元が
//       「そこに至った経緯の一覧」でしかなく、意思決定の材料を
//       補えていない)
//   (5) 足跡が複数ステップ(キーワード選択→起点確定→キーワード選択…)の
//       場合に、記録順ではなく最後の1件だけが実行されてしまい、途中の
//       状態(直前の検索結果件数など)の整合性が崩れる

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

function stubFetchWithMock(html: string, fetchMock: ReturnType<typeof vi.fn>) {
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });
  vi.stubGlobal('fetch', fetchMock);
}

describe('sessionStorageからの復元は足跡チップだけでなく、実際の選択状況(グラフ・検索結果)まで再現する', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  // a:seed -(k:a)-> a:mid
  const graphNodes = [
    { id: 'a:seed', type: 'answer', label: 'seed', depth: 0 },
    { id: 'k:a', type: 'keyword', label: 'kw-a', depth: 1 },
    { id: 'a:mid', type: 'answer', label: 'mid', depth: 2 },
  ];
  const graphEdges = [
    { from: 'a:seed', to: 'k:a' },
    { from: 'k:a', to: 'a:mid' },
  ];

  it('起点(seed)の足跡が復元されると、グラフ取得APIがその起点のshareIdで呼ばれ、グラフが再読み込みされる', async () => {
    sessionStorage.setItem(TRAIL_KEY, JSON.stringify([{ type: 'seed', label: '質問1(起点)', id: 'seed' }]));
    const html = buildPage(true);
    const fetchMock = vi.fn((url: string, init?: { body?: string }) => {
      if (String(url).includes('/api/aichat/answer-propagation-graph')) {
        return Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify({ nodes: graphNodes, edges: graphEdges })) });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    stubFetchWithMock(html, fetchMock);

    const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();
    await new Promise((resolve) => setTimeout(resolve, 30));

    const graphCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/aichat/answer-propagation-graph'));
    expect(graphCalls.length).toBe(1);
    expect(JSON.parse((graphCalls[0][1] as { body: string }).body)).toEqual({ shareId: 'seed' });

    // グラフが実際に再構築されたことを、回答文キーワードバー(グラフ依存の
    // 表示)が正しく描画されていることで確認する
    const answerKeywordsBar = document.getElementById('answerKeywordsBar')!;
    expect(answerKeywordsBar.style.display).toBe('flex');
    expect(answerKeywordsBar.textContent).toContain('kw-a');
  });

  it('キーワード→起点確定の複数ステップの足跡が、記録順に再実行されて最終状態(検索結果・グラフ)が再現される', async () => {
    sessionStorage.setItem(TRAIL_KEY, JSON.stringify([
      { type: 'keyword', label: 'kw-a' },
      { type: 'seed', label: '質問2(mid)', id: 'mid' },
    ]));
    const html = buildPage(true);
    let searchCallCount = 0;
    const fetchMock = vi.fn((url: string, init?: { body?: string }) => {
      const u = String(url);
      if (u.includes('/api/aichat/shares/search')) {
        searchCallCount++;
        expect(u).toContain(encodeURIComponent('kw-a'));
        return Promise.resolve({ json: () => Promise.resolve({ results: [
          { id: 'mid', question: '質問2(mid)', created_at: '2026-01-02T00:00:00.000Z', keywordCount: 1 },
        ] }) });
      }
      if (u.includes('/api/aichat/answer-propagation-graph')) {
        expect(JSON.parse((init!.body as string))).toEqual({ shareId: 'mid' });
        return Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify({ nodes: graphNodes, edges: graphEdges })) });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    stubFetchWithMock(html, fetchMock);

    const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();
    await new Promise((resolve) => setTimeout(resolve, 30));

    // 検索(kw-aの再検索)→グラフ取得(mid起点)の順に実行されたことを確認
    expect(searchCallCount).toBe(1);
    const graphCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/aichat/answer-propagation-graph'));
    expect(graphCalls.length).toBe(1);

    // 検索窓にも最後に選んだキーワードが反映される
    const seedSearchInput = document.getElementById('seedSearchInput') as HTMLInputElement;
    expect(seedSearchInput.value).toBe('kw-a');

    // 最終的にグラフが読み込まれ、起点(mid)行がselected状態になる
    const seedSearchResults = document.getElementById('seedSearchResults')!;
    const selectedRow = seedSearchResults.querySelector('.search-result-row.selected');
    expect(selectedRow).not.toBeNull();
  });
});

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
