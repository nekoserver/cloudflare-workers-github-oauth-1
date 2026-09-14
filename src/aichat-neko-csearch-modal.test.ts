// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAiChatPage } from './views/aichat';
import { formatAichatNekoCsearchResults } from './utils/aichatSlashCommand';

// 対象: /aichat 入力窓のスラッシュコマンド `/neko csearch` 応答。質問文表の「回答全文」リンクを
// 押すと最上位レイヤーの専用モーダルが開き、回答キャッシュ
// (GET /api/cursor-agent/history/:id/conversation) から全文を読む。
// /neko search の nekoResults / historyModal とは混ぜない。
//
// 故障シナリオ:
//   (1) 表や回答全文リンクが出ない
//   (2) リンクが AIチャット詳細(historyModal)や nekoResultsModal を開く
//   (3) キャッシュ取得失敗を空のまま握りつぶす
//   (4) モーダルが getNextZ 未登録で裏に入る

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
    if (u.includes('/api/cursor-agent/history/11/conversation')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ answers: ['キャッシュの回答全文です'], source: 'cache' }),
      });
    }
    if (u.includes('/api/cursor-agent/history/12/conversation')) {
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: '見つかりません' }),
      });
    }
    if (u.includes('/api/aichat/shares/')) {
      return Promise.resolve({
        json: () => Promise.resolve({
          id: 's1', question: '誤って開いた', answer: 'AIチャット側',
          model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', created_at: '2026-08-09T00:00:00.000Z',
          access_count: 1, user_hash: 'hash123',
        }),
      });
    }
    if (u.includes('/api/aichat')) {
      return Promise.resolve({ json: () => Promise.resolve(apiResponse) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
  vi.stubGlobal('fetch', fetchMock);

  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();

  const chatInput = document.getElementById('chatInput') as HTMLTextAreaElement;
  const chatForm = document.getElementById('chatForm') as HTMLFormElement;
  chatInput.value = '/neko csearch readme';
  chatForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 10));

  return { fetchMock };
}

describe('AIチャット(DOM実動作): /neko csearch の質問文表と回答全文モーダル', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('nekoCursorResultsがある場合、応答バブルに質問文表と回答全文リンクが出る', async () => {
    const results = [
      { id: 11, question: 'READMEを直して' },
      { id: 12, question: '検索フォールバック' },
    ];
    await setupChatSubmitTest({
      response: formatAichatNekoCsearchResults('readme', { results }),
      usedModel: 'local/neko',
      nekoResults: null,
      nekoCursorResults: results,
    });

    const bubble = document.querySelector('.chat-bubble.assistant') as HTMLElement;
    expect(bubble.textContent).toContain('READMEを直して');
    expect(bubble.textContent).toContain('検索フォールバック');
    const links = document.querySelectorAll('.csearch-answer-link');
    expect(links).toHaveLength(2);
    expect(links[0].textContent).toBe('回答全文');
    expect(links[0].getAttribute('data-launch-id')).toBe('11');
    expect(document.querySelector('.neko-results-link')).toBeNull();
  });

  it('ヒット0件では回答全文リンクも表も出さない', async () => {
    await setupChatSubmitTest({
      response: formatAichatNekoCsearchResults('readme', { results: [] }),
      usedModel: 'local/neko',
      nekoCursorResults: [],
    });
    expect(document.querySelector('.csearch-answer-link')).toBeNull();
    expect(document.querySelector('.csearch-result-table')).toBeNull();
  });

  it('回答全文をクリックすると専用モーダルが最上位で開き、キャッシュ本文を表示する', async () => {
    const results = [{ id: 11, question: 'READMEを直して' }];
    const { fetchMock } = await setupChatSubmitTest({
      response: formatAichatNekoCsearchResults('readme', { results }),
      usedModel: 'local/neko',
      nekoCursorResults: results,
    });

    const link = document.querySelector('.csearch-answer-link') as HTMLElement;
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/cursor-agent/history/11/conversation',
      expect.objectContaining({ credentials: 'same-origin' }),
    );
    const modal = document.getElementById('cursorAgentAnswerModal')!;
    expect(modal.classList.contains('open')).toBe(true);
    expect(Number(modal.style.zIndex)).toBeGreaterThan(0);
    expect(document.getElementById('cursorAgentAnswerModalTitle')!.textContent).toContain('READMEを直して');
    expect(document.getElementById('cursorAgentAnswerModalBody')!.textContent).toBe('キャッシュの回答全文です');
    expect(document.getElementById('historyModalBackdrop')!.classList.contains('open')).toBe(false);
    expect(document.getElementById('nekoResultsModal')!.classList.contains('open')).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/aichat/shares/'))).toBe(false);
  });

  it('会話APIがエラーを返しても空にせずモーダルへ書く', async () => {
    const results = [{ id: 12, question: '無い起動' }];
    await setupChatSubmitTest({
      response: formatAichatNekoCsearchResults('x', { results }),
      usedModel: 'local/neko',
      nekoCursorResults: results,
    });
    const link = document.querySelector('.csearch-answer-link') as HTMLElement;
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(document.getElementById('cursorAgentAnswerModal')!.classList.contains('open')).toBe(true);
    expect(document.getElementById('cursorAgentAnswerModalBody')!.textContent).toContain('見つかりません');
  });

  it('#cursorAgentAnswerModal はstaticZDefaultsに登録済み(CLAUDE.mdルール26)', () => {
    const html = buildPage();
    const idx = html.indexOf('var staticZDefaults = {');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 800);
    expect(block).toContain('cursorAgentAnswerModal');
  });
});
