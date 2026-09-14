// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAiChatPage } from './views/aichat';
import {
  buildAichatQsearchIdHref,
  formatAichatNekoQsearchResults,
} from './utils/aichatSlashCommand';

// 対象: /aichat 入力窓のスラッシュコマンド `/neko qsearch` 応答。
// 表の行頭の質問IDリンクを押すと、質問文・モデルを付けて
// GET /api/aichat/qsearch/latest-answer を呼び、最新回答を最上位モーダルでMarkdown表示する。
// リンクに下線は付けない。/neko search の nekoResults / historyModal と /neko csearch とは混ぜない。
//
// 故障シナリオ:
//   (1) 行頭に質問IDの実リンクが出ない
//   (2) リンクに下線が残る
//   (3) クリックが historyModal や csearch モーダルを開く
//   (4) APIに question/model を付けない
//   (5) モーダルが getNextZ 未登録で裏に入る
//   (6) 回答が textContent のままで見出し・太字にならない
//   (7) parseMdを通さず生HTMLをinnerHTMLし、XSSになる
//   (8) 取得失敗を空のまま握りつぶす

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
    if (u.includes('/api/aichat/qsearch/latest-answer')) {
      const parsed = new URL(u, 'https://example.test');
      const question = parsed.searchParams.get('question') || '';
      const model = parsed.searchParams.get('model') || '';
      if (question === 'XSS確認') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ answer: '<img src=x onerror=alert(1)>' }),
        });
      }
      if (question === '見つからない') {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: '一致する過去ログがありません' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          answer: '## 完了\n\n**最新回答**です',
          id: 'new',
          question,
          model,
        }),
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
    if (u.includes('/api/cursor-agent/history/')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ answers: ['Cursor側を開いてはいけない'], source: 'cache' }),
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
  chatInput.value = '/neko qsearch 駅';
  chatForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 10));

  return { fetchMock };
}

describe('AIチャット(DOM実動作): /neko qsearch の質問IDと最新回答モーダル', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('応答バブルの行頭に質問IDの実リンクが出る', async () => {
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
    const links = document.querySelectorAll('.qsearch-id-link');
    expect(links).toHaveLength(2);
    expect(links[0].tagName).toBe('A');
    expect(links[0].textContent).toBe('s1');
    expect(links[0].getAttribute('href')).toBe(buildAichatQsearchIdHref(results[0]));
    expect(links[1].textContent).toBe('s2');
    expect(bubble.textContent).toContain('東京駅について');
    expect(document.querySelector('.neko-results-link')).toBeNull();
    expect(document.querySelector('.csearch-answer-link')).toBeNull();
  });

  it('質問IDリンクのCSSは下線を付けない', () => {
    const html = buildPage();
    const idx = html.indexOf('.qsearch-id-link');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, html.indexOf('}', idx) + 1);
    expect(block).toContain('text-decoration: none');
    expect(block).not.toContain('text-decoration: underline');
  });

  it('回答モーダル本体はpreview-areaのdivで、getNextZに登録されている', () => {
    const html = buildPage();
    expect(html).toContain('id="qsearchAnswerModal"');
    expect(html).toMatch(/<div[^>]*id="qsearchAnswerModalBody"[^>]*class="[^"]*preview-area/);
    expect(html).toContain('qsearchAnswerModal: 700');
    expect(html).not.toMatch(/<pre id="qsearchAnswerModalBody"/);
  });

  it('質問IDクリック後、questionとmodelを付けて最新回答APIを呼びMarkdown描画する', async () => {
    const results = [{ id: 's1', question: '東京駅について', model: 'gpt-5' }];
    const { fetchMock } = await setupChatSubmitTest({
      response: formatAichatNekoQsearchResults('駅', { results }),
      usedModel: 'local/neko',
    });
    const link = document.querySelector('.qsearch-id-link') as HTMLAnchorElement;
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    const latestCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/aichat/qsearch/latest-answer'));
    expect(latestCalls).toHaveLength(1);
    const called = String(latestCalls[0][0]);
    expect(called).toContain('question=');
    expect(called).toContain('model=');
    expect(decodeURIComponent(called)).toContain('東京駅について');
    expect(decodeURIComponent(called)).toContain('gpt-5');
    const modal = document.getElementById('qsearchAnswerModal')!;
    expect(modal.classList.contains('open')).toBe(true);
    const body = document.getElementById('qsearchAnswerModalBody')!;
    expect(body.classList.contains('preview-area')).toBe(true);
    expect(body.querySelector('h2')?.textContent).toBe('完了');
    expect(body.querySelector('strong')?.textContent).toBe('最新回答');
    expect(document.getElementById('cursorAgentAnswerModal')?.classList.contains('open')).toBe(false);
    expect(document.getElementById('historyModalBackdrop')?.classList.contains('open') ?? false).toBe(false);
  });

  it('回答に生HTMLがあってもparseMd経由でエスケープされ、imgは作られない', async () => {
    const results = [{ id: 's3', question: 'XSS確認', model: 'gpt-5' }];
    await setupChatSubmitTest({
      response: formatAichatNekoQsearchResults('xss', { results }),
      usedModel: 'local/neko',
    });
    const link = document.querySelector('.qsearch-id-link') as HTMLAnchorElement;
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    const body = document.getElementById('qsearchAnswerModalBody')!;
    expect(body.querySelector('img')).toBeNull();
    expect(body.innerHTML).toContain('&lt;img');
  });

  it('API失敗は空にせずモーダルへエラーを出す', async () => {
    const results = [{ id: 's4', question: '見つからない', model: 'gpt-5' }];
    await setupChatSubmitTest({
      response: formatAichatNekoQsearchResults('x', { results }),
      usedModel: 'local/neko',
    });
    const link = document.querySelector('.qsearch-id-link') as HTMLAnchorElement;
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    const body = document.getElementById('qsearchAnswerModalBody')!;
    expect(body.textContent).toContain('一致する過去ログがありません');
    expect(body.querySelector('h2')).toBeNull();
  });
});
