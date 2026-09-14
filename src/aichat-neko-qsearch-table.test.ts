// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAiChatPage } from './views/aichat';
import { formatAichatNekoQsearchResults } from './utils/aichatSlashCommand';

// 対象: /aichat 入力窓のスラッシュコマンド `/neko qsearch` 応答。
// 質問文と回答モデルのMarkdown表が応答バブルに出ること。
// /neko search の件数表示や /neko csearch の Cursor VM 表と混ぜない。
//
// 故障シナリオ:
//   (1) 表やモデル列が出ない
//   (2) /neko search 用の結果一覧リンクが出て件数表示に戻る

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};

async function setupChatSubmitTest(apiResponse: Record<string, unknown>) {
  const html = getAiChatPage(minimalUser);
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (String(url).includes('/api/aichat')) {
      return Promise.resolve({ json: () => Promise.resolve(apiResponse) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
  const chatInput = document.getElementById('chatInput') as HTMLTextAreaElement;
  const chatForm = document.getElementById('chatForm') as HTMLFormElement;
  chatInput.value = '/neko qsearch 駅';
  chatForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 10));
}

describe('AIチャット(DOM実動作): /neko qsearch の質問文・モデル表', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('ヒット時は応答バブルに質問文とモデルの表が出る', async () => {
    const results = [
      { id: 's1', question: '東京駅について', model: 'llama-3.3-70b-instruct-fp8-fast' },
      { id: 's2', question: '新幹線について', model: 'gpt-5' },
    ];
    await setupChatSubmitTest({
      response: formatAichatNekoQsearchResults('駅', { results }),
      usedModel: 'local/neko',
      nekoResults: null,
    });
    const bubble = document.querySelector('.chat-bubble.assistant') as HTMLElement;
    expect(bubble.textContent).toContain('東京駅について');
    expect(bubble.textContent).toContain('llama-3.3-70b-instruct-fp8-fast');
    expect(bubble.textContent).toContain('新幹線について');
    expect(bubble.textContent).toContain('gpt-5');
    const table = bubble.querySelector('table');
    expect(table).not.toBeNull();
    expect(table!.textContent).toContain('質問文');
    expect(table!.textContent).toContain('モデル');
    expect(document.querySelector('.neko-results-link')).toBeNull();
    expect(document.querySelector('.csearch-answer-link')).toBeNull();
  });

  it('ヒット0件では表を出さない', async () => {
    await setupChatSubmitTest({
      response: formatAichatNekoQsearchResults('駅', { results: [] }),
      usedModel: 'local/neko',
    });
    const bubble = document.querySelector('.chat-bubble.assistant') as HTMLElement;
    expect(bubble.textContent).toContain('0件');
    expect(bubble.querySelector('table')).toBeNull();
  });
});
