// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAiChatPage } from './views/aichat';

// 対象: AIチャットページ(/aichat)の /neko tlist 応答バブル。
// formatCountdownListResult()が0件時に返す「## 次の予定一覧」見出しの行末に
// 「登録」ボタンを追加し、押すとカウントダウンページと同じ登録機能一式
// (openCountdownQuickAddModal、src/utils/countdownQuickAdd.ts)を呼び出して
// その場で予定登録まで行えることを検証する。
//
// 故障シナリオ:
//   (1) 予定が1件以上ある応答にもボタンが付いてしまう(既に予定があるのに
//       登録を促すのは不適切)
//   (2) 通常のAI応答やAI生成テーブルにも誤ってボタンが付いてしまう
//   (3) ボタンを押してもモーダルが開かない、またはモーダル経由の登録が
//       /api/countdownへのPOSTに繋がらない

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};

const EMPTY_TLIST_RESPONSE = '## 次の予定一覧\n登録されている予定はありません(/countdownページから登録できます)';
const NON_EMPTY_TLIST_RESPONSE = '## 次の予定一覧\n| 日時 | 予定 |\n|---|---|\n| 2026/09/01 09:00 | 会議 |';

function buildPage(): string {
  return getAiChatPage(minimalUser);
}

async function setupChatSubmitTest(apiResponse: Record<string, unknown>, message: string) {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });

  const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/aichat')) {
      return Promise.resolve({ json: () => Promise.resolve(apiResponse) });
    }
    if (u.includes('/api/countdown')) {
      return Promise.resolve({ json: () => Promise.resolve({ id: 1 }) });
    }
    return Promise.resolve({ json: () => Promise.resolve({}) });
  });
  vi.stubGlobal('fetch', fetchMock);

  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();

  const chatInput = document.getElementById('chatInput') as HTMLTextAreaElement;
  const chatForm = document.getElementById('chatForm') as HTMLFormElement;
  chatInput.value = message;
  chatForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 10));
  return fetchMock;
}

describe('AIチャット(DOM実動作): /neko tlist 応答バブルの「登録」ボタン', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('次の予定が0件の場合、見出しに「登録」ボタンが付く', async () => {
    await setupChatSubmitTest({ response: EMPTY_TLIST_RESPONSE, usedModel: 'local/neko', nekoResults: null }, '/neko tlist');

    const heading = document.querySelector('.chat-bubble.assistant h2') as HTMLElement;
    expect(heading).toBeTruthy();
    expect(heading.textContent).toContain('次の予定一覧');
    const btn = heading.querySelector('.tlist-register-btn');
    expect(btn).toBeTruthy();
    expect(btn!.textContent).toBe('登録');
  });

  it('次の予定が1件以上ある場合はボタンが付かない', async () => {
    await setupChatSubmitTest({ response: NON_EMPTY_TLIST_RESPONSE, usedModel: 'local/neko', nekoResults: null }, '/neko tlist');

    const heading = document.querySelector('.chat-bubble.assistant h2') as HTMLElement;
    expect(heading).toBeTruthy();
    expect(heading.querySelector('.tlist-register-btn')).toBeNull();
  });

  it('/neko tlist以外のローカルコマンド応答(同じ見出し文言を偶然含む通常テキスト)にはボタンが付かない', async () => {
    const otherLocalText = '通常の応答の中に次の予定一覧という言葉が含まれるだけのケース';
    await setupChatSubmitTest({ response: otherLocalText, usedModel: 'local/neko', nekoResults: null }, '/neko search 何か');

    expect(document.querySelector('.chat-bubble.assistant .tlist-register-btn')).toBeNull();
  });

  it('ボタンを押すとカウントダウンのクイック登録モーダルが開く', async () => {
    await setupChatSubmitTest({ response: EMPTY_TLIST_RESPONSE, usedModel: 'local/neko', nekoResults: null }, '/neko tlist');

    const btn = document.querySelector('.tlist-register-btn') as HTMLButtonElement;
    btn.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));

    const overlay = document.getElementById('countdownQuickAddOverlay') as HTMLElement;
    expect(overlay.className).toContain('open');
  });

  it('ボタン→モーダル→保存の一連の操作でPOST /api/countdownまで到達する', async () => {
    const fetchMock = await setupChatSubmitTest({ response: EMPTY_TLIST_RESPONSE, usedModel: 'local/neko', nekoResults: null }, '/neko tlist');

    const btn = document.querySelector('.tlist-register-btn') as HTMLButtonElement;
    btn.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));

    (document.getElementById('countdownQaLabel') as HTMLInputElement).value = '打ち合わせ';
    (document.getElementById('countdownQaDate') as HTMLInputElement).value = '2026-09-05';
    document.getElementById('countdownQaSaveBtn')!.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const countdownCall = fetchMock.mock.calls.find(
      (call) => String(call[0]) === '/api/countdown' && (call[1] as RequestInit | undefined)?.method === 'POST'
    );
    expect(countdownCall).toBeTruthy();
    const body = JSON.parse((countdownCall![1] as RequestInit).body as string);
    expect(body.label).toBe('打ち合わせ');
  });
});
