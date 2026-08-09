// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAiChatPage } from './views/aichat';

// 対象: AIチャットページ(/aichat)で /neko search・/neko vcount のような
// ローカル完結サブコマンド(usedModel === 'local/neko')が、ヒット結果
// (nekoResults)を伴って返ってきた場合の表示。チャット画面を応答で埋め
// 尽くさないための暫定措置として、一覧は応答バブル本文に直接書き出さず、
// 「📋 ヒット結果一覧を表示」リンクを埋め込み、クリックすると最上位レイヤーの
// モーダル(#nekoResultsModal)に最大30件の質問文リンクを表形式で表示する。
// 各行の質問文リンクからは、それぞれの回答が書き込まれたAIチャットの
// 詳細プレビュー(historyModal)を呼び出せる。
//
// 故障シナリオ:
//   (1) nekoResultsが無い/空の場合でもリンクが表示されてしまう
//   (2) nekoResultsがある場合にリンクが表示されない、またはクリックしても
//       モーダルが開かない
//   (3) モーダルの行数がnekoResultsの件数と一致しない
//   (4) 行の質問文リンクをクリックしても詳細プレビュー(historyModal)が
//       開かない、または誤ったshareIdで開いてしまう
//   (5) 通常のAI応答(local/nekoでない)にもリンクが表示されてしまう

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};

function buildPage(): string {
  return getAiChatPage(minimalUser);
}

async function setupChatSubmitTest(apiResponse: Record<string, unknown>) {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));

  const fetchMock = vi.fn((url: string) => {
    const u = String(url);
    if (u.includes('/api/aichat/shares/')) {
      return Promise.resolve({
        json: () => Promise.resolve({
          id: 's1', question: '東京駅について', answer: '東京駅は...',
          model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', created_at: '2026-08-09T00:00:00.000Z',
          access_count: 1, user_hash: 'hash123',
        }),
      });
    }
    if (u.includes('/api/aichat/share-keywords')) {
      return Promise.resolve({ json: () => Promise.resolve({ keywords: [] }) });
    }
    if (u.includes('/api/aichat/subqueries') || u.includes('share-subquery-links')) {
      return Promise.resolve({ json: () => Promise.resolve({ links: [] }) });
    }
    if (u.includes('/api/aichat')) {
      return Promise.resolve({ json: () => Promise.resolve(apiResponse) });
    }
    return Promise.resolve({ json: () => Promise.resolve({}) });
  });
  vi.stubGlobal('fetch', fetchMock);

  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();

  const chatInput = document.getElementById('chatInput') as HTMLTextAreaElement;
  const chatForm = document.getElementById('chatForm') as HTMLFormElement;
  chatInput.value = '/neko search 駅';
  chatForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 10));

  return { fetchMock };
}

describe('AIチャット(DOM実動作): /neko コマンド応答のヒット結果一覧モーダル', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('nekoResultsがある場合、応答バブルに「ヒット結果一覧を表示」リンクが表示される', async () => {
    await setupChatSubmitTest({
      response: '「駅」を質問文・回答文に含む過去ログ: 2件',
      usedModel: 'local/neko',
      nekoResults: [{ id: 's1', question: '東京駅について' }, { id: 's2', question: '新幹線について' }],
    });

    const link = document.querySelector('.neko-results-link');
    expect(link).not.toBeNull();
    expect(link!.textContent).toContain('2件');
  });

  it('nekoResultsが空配列の場合はリンクを表示しない', async () => {
    await setupChatSubmitTest({
      response: '「見つからない」を質問文・回答文に含む過去ログ: 0件',
      usedModel: 'local/neko',
      nekoResults: [],
    });

    expect(document.querySelector('.neko-results-link')).toBeNull();
  });

  it('nekoResultsがnullの場合(通常のAI応答)はリンクを表示しない', async () => {
    await setupChatSubmitTest({
      response: '通常のAI応答です',
      usedModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      nekoResults: null,
    });

    expect(document.querySelector('.neko-results-link')).toBeNull();
  });

  it('リンクをクリックするとモーダルが開き、nekoResultsの件数分の行が表示される', async () => {
    await setupChatSubmitTest({
      response: '「駅」を質問文・回答文に含む過去ログ: 3件',
      usedModel: 'local/neko',
      nekoResults: [
        { id: 's1', question: '東京駅について' },
        { id: 's2', question: '新幹線について' },
        { id: 's3', question: '乗車券について' },
      ],
    });

    const link = document.querySelector('.neko-results-link') as HTMLElement;
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    const modal = document.getElementById('nekoResultsModal')!;
    expect(modal.classList.contains('open')).toBe(true);
    const rows = document.querySelectorAll('#nekoResultsModalBody td[data-share-id]');
    expect(rows).toHaveLength(3);
    expect(rows[0].getAttribute('data-share-id')).toBe('s1');
    expect(rows[0].textContent).toContain('東京駅について');
  });

  it('モーダル内の質問文リンクをクリックすると、対応するshareIdで詳細プレビュー(historyModal)が開く', async () => {
    const { fetchMock } = await setupChatSubmitTest({
      response: '「駅」を質問文・回答文に含む過去ログ: 1件',
      usedModel: 'local/neko',
      nekoResults: [{ id: 's1', question: '東京駅について' }],
    });

    const link = document.querySelector('.neko-results-link') as HTMLElement;
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    const row = document.querySelector('#nekoResultsModalBody td[data-share-id]') as HTMLElement;
    row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(fetchMock).toHaveBeenCalledWith('/api/aichat/shares/s1', expect.anything());
    const historyModal = document.getElementById('historyModalBackdrop')!;
    expect(historyModal.classList.contains('open')).toBe(true);
    expect(document.getElementById('historyModalDateLink')!.textContent).toBe('2026-08-09');
  });

  it('#nekoResultsModal はstaticZDefaultsに登録済み(getNextZの見落とし防止、CLAUDE.mdルール26)', () => {
    const html = buildPage();
    const idx = html.indexOf('var staticZDefaults = {');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 400);
    expect(block).toContain('nekoResultsModal');
  });
});
