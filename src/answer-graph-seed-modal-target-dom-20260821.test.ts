// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページの起点検索(#seedSearchTarget)でヒットした起点
// (質問文リンク .question-line)をタップした際に開く応答バブルモーダル
// (openAnswerModal)が、検索対象(target)に応じて GET /api/aichat/shares/:id
// を正しいtarget付きで叩くかどうか。
//
// バグ: 起点検索でmoondream3.1を検索対象に指定していても、クライアント側の
// openAnswerModalが検索対象(target)を一切記憶・伝播しておらず、モーダルの
// fetchは常に target なし(=llama-4扱い)で行われていた。
//
// 故障シナリオ:
//   (1) target=moondream3.1で検索・選択した起点をタップしてもtargetが
//       fetchに渡らない(本バグ。このファイルで検証)
//   (2) target=llama-4(デフォルト)ではtargetクエリが付与されない
//       (退行防止。別ファイル answer-graph-seed-modal-target-dom-llama4-20260821.test.ts
//       で検証。document.addEventListener('click', ...)がスクリプト実行の
//       たびに積み上がり、同一ファイル内の他テストの検索対象(target)が
//       残ってしまう(旧リスナーがフリーズしたクロージャのtargetを使って
//       fetchしてしまう)ため、シナリオごとにファイルを分けてjsdomの
//       documentを完全に分離している)

function buildPage(): string {
  return getAnswerGraphPage('testuser', {}, false);
}

function setup() {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });
  const fetchMock = vi.fn((url: string) => {
    if (String(url).indexOf('/api/aichat/shares/search') !== -1) {
      return Promise.resolve({
        json: () => Promise.resolve({
          results: [{ id: 's1', user_hash: 'h', question: '質問1', answer: '回答1', model: 'llama-4', created_at: '2026-08-21T00:00:00Z', keywordCount: 3, vectorized: false }],
        }),
      });
    }
    if (String(url).indexOf('/api/aichat/answer-propagation-graph') !== -1) {
      return Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify({ nodes: [], edges: [] })) });
    }
    if (String(url).indexOf('/api/aichat/shares/') !== -1) {
      return Promise.resolve({ json: () => Promise.resolve({ id: 's1', question: '質問1', answer: '回答1', model: 'llama-4' }) });
    }
    return Promise.resolve({ json: () => Promise.resolve({}) });
  });
  vi.stubGlobal('fetch', fetchMock);
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
  return { fetchMock };
}

async function searchAndClickSeedRow(target: string) {
  const targetSelect = document.getElementById('seedSearchTarget') as unknown as HTMLSelectElement;
  targetSelect.value = target;
  targetSelect.dispatchEvent(new Event('change', { bubbles: true }));
  const input = document.getElementById('seedSearchInput') as HTMLInputElement;
  input.value = 'ねこ';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 400));
  const row = document.querySelector('#seedSearchResults tr.search-result-row') as HTMLElement;
  expect(row).toBeTruthy();
  row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('/answer-graph 応答バブルモーダル(openAnswerModal)のtarget伝播(DOM実動作: moondream3.1)', () => {
  it('target=moondream3.1で検索・選択した起点の質問文リンクをタップすると、モーダルのfetchにtarget=moondream3.1が渡る', async () => {
    const { fetchMock } = setup();
    await searchAndClickSeedRow('moondream3.1');
    fetchMock.mockClear();

    // キーワードから呼び出された質問文リンク(.question-line)をタップする状況を再現する
    const link = document.createElement('div');
    link.className = 'question-line';
    link.setAttribute('data-share-id', 's1');
    document.body.appendChild(link);
    link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const shareDetailCalls = fetchMock.mock.calls.filter((c: unknown[]) => String(c[0]).indexOf('/api/aichat/shares/s1') !== -1 && String(c[0]).indexOf('search') === -1);
    expect(shareDetailCalls.length).toBeGreaterThan(0);
    expect(String(shareDetailCalls[0][0])).toBe('/api/aichat/shares/s1?target=moondream3.1');
  });
});
