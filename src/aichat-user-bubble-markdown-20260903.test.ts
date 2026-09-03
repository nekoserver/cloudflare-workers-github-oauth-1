import { describe, expect, it, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { getAiChatPage } from './views/aichat';

// 対象: AIチャット(/aichat)の入力窓に入力したMarkdownを、質問(ユーザー)バブルにも
// Markdownとして描画する機能。これまで質問バブルはtextContentで生テキストの
// まま表示していたため、表(テーブル)等の構造がそのまま文字列として見えていた。
// appendBubble/appendHistoryModalBubble/再質問確認モーダルのqBubbleの3箇所を
// parseMd(既存のMarkdownパーサー)でinnerHTML描画するよう変更した。
//
// 送信データ自体(message文字列、D1保存のquestionカラム)は元々加工せず
// そのまま渡していたため変更不要(サーバー側は無変更)。
//
// 故障シナリオ:
//   (1) parseMdへの切り替えでMarkdownテーブルが実際には<table>として
//       描画されない(構文追加ミス・分岐漏れ)
//   (2) parseMdはesc()で生テキストをエスケープしてからMarkdown記法を適用する
//       安全な実装だが、切り替え作業中に誤ってinnerHTMLへの生テキスト直書きに
//       なってしまうと、ユーザー入力中の<script>等がそのままDOMに実行される
//       XSSになる(「副作用を取り除く」の核心。ここを最優先で検証する)
//   (3) 'thinking'(考え中...)やエラーバブルまでMarkdown解釈されてしまい、
//       システム生成の定型文の見た目が意図せず変わる

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};

let dom: JSDOM | undefined;

afterEach(() => {
  if (dom) {
    dom.window.close();
    dom = undefined;
  }
});

function buildDom(fetchImpl: typeof fetch): JSDOM {
  const html = getAiChatPage(minimalUser);
  const instance = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://example.com/aichat',
    // ページの<script>はDOMContentLoaded以前に実行される部分もあり、
    // 例えば通知ポーリング(fetchNextEvent)のような無関係な処理が
    // window.fetch未定義でReferenceErrorを投げると、その時点で
    // <script>ブロック全体の残り(chatForm等のイベント登録含む)が
    // 実行されなくなる。beforeParseでスクリプト実行前にfetchを
    // 差し込むことでこれを防ぐ(construction後の代入では間に合わない)。
    beforeParse(window) {
      window.fetch = fetchImpl as unknown as typeof window.fetch;
    },
  });
  instance.window.matchMedia = instance.window.matchMedia || ((() => ({
    matches: false, addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof instance.window.matchMedia);
  return instance;
}

function stubFetch(): typeof fetch {
  return (async (url: string) => {
    const u = String(url);
    if (u.indexOf('/api/aichat') !== -1) {
      return new Response(JSON.stringify({
        answer: 'ok', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', shareId: 'share1', userHash: 'hash1',
      }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  }) as unknown as typeof fetch;
}

function submitMessage(dom: JSDOM, message: string) {
  const { window } = dom;
  const { document } = window;
  const chatInput = document.getElementById('chatInput') as HTMLTextAreaElement;
  const chatForm = document.getElementById('chatForm') as HTMLFormElement;
  chatInput.value = message;
  chatForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
}

describe('E2E: AIチャット入力窓のMarkdownが質問バブルにそのまま描画される', () => {
  it('Markdownの表を入力すると質問バブルに<table>要素として描画される', async () => {
    dom = buildDom(stubFetch());
    const { document } = dom.window;

    const md = '| a | b |\n|---|---|\n| 1 | 2 |';
    submitMessage(dom, md);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const userBubble = document.querySelector('.chat-bubble.user') as HTMLElement | null;
    expect(userBubble, '質問バブルが描画されていない').not.toBeNull();
    expect(userBubble!.classList.contains('preview-area')).toBe(true);
    const table = userBubble!.querySelector('table');
    expect(table, 'Markdownの表が<table>として描画されていない').not.toBeNull();
    expect(table!.querySelectorAll('td').length).toBe(2);
  });

  it('入力に<script>タグを含めても実行されず、エスケープされた文字列として表示される(XSS対策)', async () => {
    dom = buildDom(stubFetch());
    const { document } = dom.window;

    const payload = '<script>window.__xssFired = true;</script>';
    submitMessage(dom, payload);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((dom.window as unknown as { __xssFired?: boolean }).__xssFired).toBeUndefined();
    const userBubble = document.querySelector('.chat-bubble.user') as HTMLElement | null;
    expect(userBubble, '質問バブルが描画されていない').not.toBeNull();
    expect(userBubble!.querySelector('script')).toBeNull();
    expect(userBubble!.textContent).toContain('<script>');
  });

  it('img onerrorペイロードもエスケープされ、イベントハンドラとしては実行されない', async () => {
    dom = buildDom(stubFetch());
    const { document } = dom.window;

    const payload = '<img src=x onerror="window.__xssFired2 = true">';
    submitMessage(dom, payload);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((dom.window as unknown as { __xssFired2?: boolean }).__xssFired2).toBeUndefined();
    const userBubble = document.querySelector('.chat-bubble.user') as HTMLElement | null;
    // Markdownの![alt](url)構文ではないため<img>要素にはならず、
    // エスケープされたテキストとしてそのまま表示される。
    expect(userBubble!.querySelector('img[onerror]')).toBeNull();
  });

  it('「考え中...」のthinkingバブルはMarkdown解釈されずtextContentのまま表示される', () => {
    dom = buildDom(stubFetch());
    const { document } = dom.window;

    // 実際の応答fetchが解決してthinkingバブルが差し替わる前(同期的な
    // submitハンドラの完了直後)の時点でDOMを確認する。
    submitMessage(dom, 'hello');

    const thinkingBubble = document.querySelector('.chat-bubble.thinking') as HTMLElement | null;
    expect(thinkingBubble, 'thinkingバブルが見つからない').not.toBeNull();
    expect(thinkingBubble!.classList.contains('preview-area')).toBe(false);
    expect(thinkingBubble!.textContent).toBe('考え中...');
  });
});
