// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getAiChatPage } from './views/aichat';

// 対象: AIチャットページ(/aichat)の詳細プレビューモーダル(historyModal)。
// 過去の質問(ai_chat_shares.image_data_url)に添付画像があった場合、
// プレビューモーダルの質問バブルにも画像を表示する。
//
// 故障シナリオ:
//   (1) appendHistoryModalBubbleが画像引数を受け取らず、常に画像が表示されない
//   (2) showHistoryModal()がr.image_data_urlを渡し忘れ、APIが返しても表示されない
//   (3) 画像がない場合に空のimg要素を作ってしまい、レイアウトが崩れる
//   (4) 機能追加によりscriptタグに構文エラーが混入する

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};

function buildPage(): string {
  return getAiChatPage(minimalUser);
}

describe('/aichat ページ: 詳細プレビューモーダルの添付画像表示', () => {
  const html = buildPage();

  it('appendHistoryModalBubbleがimageDataUrl引数を受け取り、userロールでchat-bubble-imageを追加する', () => {
    const idx = html.indexOf('function appendHistoryModalBubble(text, role, imageDataUrl)');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 700);
    expect(block).toContain("bubbleImg.className = 'chat-bubble-image';");
    expect(block).toContain('bubbleImg.src = imageDataUrl;');
  });

  it('showHistoryModal()がappendHistoryModalBubbleにr.image_data_urlを渡す', () => {
    const idx = html.indexOf('function showHistoryModal(r, keyword)');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 1000);
    expect(block).toContain("appendHistoryModalBubble(r.question, 'user', r.image_data_url);");
  });

  it('script タグに構文エラーがない(詳細プレビューモーダル画像表示追加後)', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });
});

describe('appendHistoryModalBubble: DOM描画の実挙動', () => {
  function loadFn(html: string) {
    const idx = html.indexOf('function appendHistoryModalBubble(text, role, imageDataUrl)');
    const end = html.indexOf('\n    function applyKeywordHighlight', idx);
    const src = html.slice(idx, end);
    document.body.innerHTML = '<div id="historyModalChat"></div>';
    const parseMd = (t: string) => t;
    const truncateForHistoryPreview = (t: string) => t;
    const fn = new Function(
      'historyModalChat', 'parseMd', 'truncateForHistoryPreview',
      `${src}\nreturn appendHistoryModalBubble;`
    );
    return fn(document.getElementById('historyModalChat'), parseMd, truncateForHistoryPreview);
  }

  it('imageDataUrlありのuserバブルはimg.chat-bubble-imageがテキストより前に入る', () => {
    const appendHistoryModalBubble = loadFn(buildPage());
    appendHistoryModalBubble('この画像は?', 'user', 'data:image/png;base64,AAAA');
    const bubble = document.querySelector('.chat-bubble.user') as HTMLElement;
    expect(bubble).not.toBeNull();
    const img = bubble.querySelector('img.chat-bubble-image') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toContain('data:image/png;base64,AAAA');
    expect(bubble.textContent).toContain('この画像は?');
  });

  it('imageDataUrlがnull/undefinedのuserバブルには画像要素を作らない', () => {
    const appendHistoryModalBubble = loadFn(buildPage());
    appendHistoryModalBubble('こんにちは', 'user', null);
    const bubble = document.querySelector('.chat-bubble.user') as HTMLElement;
    expect(bubble.querySelector('img.chat-bubble-image')).toBeNull();
    expect(bubble.textContent).toBe('こんにちは');
  });
});
