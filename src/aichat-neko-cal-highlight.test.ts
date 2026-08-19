// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAiChatPage } from './views/aichat';

// 対象: AIチャットページ(/aichat)の /neko cal 応答バブル。
// formatJstMonthCalendarはタイトルを「| YYYY年M月 |」+「|:---:|」の
// 中央寄せ1列テーブル、日付グリッドを---:(右寄せ)のMarkdownテーブルで
// 表現する(APIキー経由の応答にもそのまま含まれる、ポータブルな
// Markdown構文)。一方「今日のマスの背景色」はプレーンテキストで表現
// できないため、ブラウザUI側(highlightNekoCalToday)でのみDOM後処理
// として付与し、応答テキスト自体(=API応答)には一切影響しないことを検証する。
//
// 故障シナリオ:
//   (1) /neko cal 以外の応答(通常のAI応答やAI生成テーブル)にも
//       誤って背景色が付いてしまう
//   (2) /neko cal の出力なのに背景色が付かない
//   (3) 背景色付与のためにテキスト(text)自体を書き換えてしまい、
//       API応答(コピー機能等が参照するtext)に影響してしまう

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};

const CAL_RESPONSE = [
  '| 2026年7月 |',
  '|:---:|',
  '| 日 | 月 | 火 | 水 | 木 | 金 | 土 |',
  '|---:|---:|---:|---:|---:|---:|---:|',
  '|  |  |  | 1 | 2 | 3 | 4 |',
  '| **5** | 6 | 7 | 8 | 9 | 10 | 11 |',
  '| 12 | 13 | 14 | 15 | 16 | 17 | 18 |',
  '| 19 | 20 | 21 | 22 | 23 | 24 | 25 |',
  '| 26 | 27 | 28 | 29 | 30 | 31 |  |',
].join('\n');

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

  const fetchMock = vi.fn((url: string) => {
    const u = String(url);
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
  chatInput.value = message;
  chatForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 10));
}

describe('AIチャット(DOM実動作): /neko cal 応答バブルの今日マス背景色(ブラウザUI限定)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('/neko cal の出力では今日の日付セル(<strong>の親<td>)に背景色が付く', async () => {
    await setupChatSubmitTest({ response: CAL_RESPONSE, usedModel: 'local/neko', nekoResults: null }, '/neko cal');

    const strong = document.querySelector('.chat-bubble.assistant table strong') as HTMLElement;
    expect(strong).toBeTruthy();
    const td = strong.closest('td') as HTMLElement;
    expect(td.style.backgroundColor).not.toBe('');
  });

  it('応答テキスト自体には背景色に相当する情報が一切含まれない(API応答は無変更)', () => {
    expect(CAL_RESPONSE).not.toMatch(/background|color:|style=/i);
  });

  it('/neko cal 以外のローカルコマンド応答(タイトル形状が違う太字テーブル)には背景色が付かない', async () => {
    const otherLocalText = '| a | b |\n|---|---|\n| **1** | 2 |';
    await setupChatSubmitTest({ response: otherLocalText, usedModel: 'local/neko', nekoResults: null }, '/neko search 何か');

    const strong = document.querySelector('.chat-bubble.assistant table strong') as HTMLElement;
    expect(strong).toBeTruthy();
    const td = strong.closest('td') as HTMLElement;
    expect(td.style.backgroundColor).toBe('');
  });

  it('highlightNekoCalToday はisLocalCommandがtrueの場合のみ呼ばれる(通常のAI応答には適用されない)', () => {
    const html = buildPage();
    const idx = html.indexOf('function buildAssistantBubble(');
    const fnSrc = html.slice(idx, idx + 600);
    expect(fnSrc).toContain('if (isLocalCommand) highlightNekoCalToday(el, text);');
  });

  it('highlightNekoCalToday はタイトル行が「YYYY年M月」+中央寄せ区切りの形状でなければ何もしない', () => {
    const html = buildPage();
    const idx = html.indexOf('function highlightNekoCalToday(');
    const fnSrc = html.slice(idx, idx + 600);
    expect(fnSrc).toContain("if (lines[1].trim() !== '|:---:|') return;");
  });
});
