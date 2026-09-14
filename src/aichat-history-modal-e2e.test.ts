import { describe, expect, it, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { getAiChatPage } from './views/aichat';

// 対象: /aichat の詳細プレビューモーダル(historyModal)への添付画像表示。
// これまでのテストはHTML文字列から関数ソースを抜き出して個別に実行する
// 方式だったため、「実際のページを開いてクリックしたときに本当に動くか」
// までは検証できていなかった。ここではjsdomの runScripts:'dangerously' で
// ページの<script>を実際に実行し、fetchをモックしてサイドバー検索結果の
// クリック→詳細プレビューモーダル表示という実際のユーザー操作を
// エンドツーエンドで再現し、最終的なDOMに画像が現れることを検証する。
//
// 故障シナリオ:
//   (1) サイドバー検索結果クリック→showHistoryPreview()→showHistoryModal()の
//       どこかで image_data_url が欠落・上書きされ、実際には画像が出ない
//   (2) getHistoryPreviewMode()のデフォルト分岐やCookie未設定時の挙動により
//       意図しないパネル表示に流れ、画像が別要素にしか出ない
//   (3) DOMContentLoaded前後のタイミング問題でイベントリスナーが
//       登録されないまま操作してしまい、クリックしても何も起きない

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
  return new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://example.com/aichat',
    beforeParse(window) {
      window.fetch = fetchImpl as unknown as typeof window.fetch;
      // jsdomはscrollIntoView/matchMedia等の一部ブラウザAPIを実装しないため、
      // ページ側コードが参照していても即例外にならないよう最低限のダミーを補う。
      window.matchMedia = window.matchMedia || ((() => ({
        matches: false, addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {},
      })) as unknown as typeof window.matchMedia);
    },
  });
}

describe('E2E: サイドバー検索結果クリック → 詳細プレビューモーダルに添付画像が表示される', () => {
  it('/api/aichat/shares/search が返す image_data_url がモーダルのimgタグに反映される', async () => {
    const imageDataUrl = 'data:image/png;base64,QUJDRA==';
    const shareRow = {
      id: 'share1', user_hash: 'hash1', question: 'この画像は何?', answer: '猫の写真です',
      model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', created_at: '2026-08-11T04:00:00.000Z',
      access_count: 0, question_hash: 'qh1', image_data_url: imageDataUrl,
    };
    const fetchImpl = (async (url: string) => {
      const u = String(url);
      if (u.indexOf('/api/aichat/shares/search') !== -1) {
        return new Response(JSON.stringify({ results: [shareRow] }), { status: 200 });
      }
      if (u.indexOf('/api/aichat/share-keywords') !== -1) {
        return new Response(JSON.stringify({ keywords: [] }), { status: 200 });
      }
      if (u.indexOf('/api/aichat/shares-by-question') !== -1) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }
      if (u.indexOf('/api/aichat/share-subquery-links') !== -1) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;

    dom = buildDom(fetchImpl);
    const { window } = dom;
    const { document } = window;

    // サイドバー検索欄に入力してEnter相当のイベントを発火させ、
    // 実際のユーザー操作(検索→結果クリック)を再現する。
    const sidebarSearch = document.getElementById('sidebarSearch') as HTMLInputElement | null;
    expect(sidebarSearch, 'sidebarSearch要素が見つからない').not.toBeNull();
    sidebarSearch!.value = 'この画像';
    sidebarSearch!.dispatchEvent(new window.Event('input', { bubbles: true }));

    // debounce等の非同期処理・fetch解決を待つ。
    await new Promise((resolve) => setTimeout(resolve, 400));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const resultItem = document.querySelector('.sidebar-result-item .result-swipe-inner') as HTMLElement | null;
    expect(resultItem, '検索結果アイテムがDOMに描画されていない(fetch結果がcurrentResultsに反映されていない可能性)').not.toBeNull();
    resultItem!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 100));

    const backdrop = document.getElementById('historyModalBackdrop');
    expect(backdrop, 'historyModalBackdropが存在しない').not.toBeNull();
    expect(backdrop!.classList.contains('open'), '詳細プレビューモーダルが開いていない').toBe(true);

    const img = document.querySelector('#historyModalChat img.chat-bubble-image') as HTMLImageElement | null;
    expect(img, '詳細プレビューモーダル内に添付画像のimgタグが見つからない').not.toBeNull();
    expect(img!.getAttribute('src')).toBe(imageDataUrl);
  });

  it('aichat_history_preview_mode=bottom-panel のときも下部パネルに添付画像が表示される', async () => {
    const imageDataUrl = 'data:image/png;base64,QUJDRA==';
    const shareRow = {
      id: 'share2', user_hash: 'hash2', question: 'この画像は何?', answer: '犬の写真です',
      model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', created_at: '2026-08-11T04:00:00.000Z',
      access_count: 0, question_hash: 'qh2', image_data_url: imageDataUrl,
    };
    const fetchImpl = (async (url: string) => {
      const u = String(url);
      if (u.indexOf('/api/aichat/shares/search') !== -1) {
        return new Response(JSON.stringify({ results: [shareRow] }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;

    dom = buildDom(fetchImpl);
    const { window } = dom;
    const { document } = window;
    document.cookie = 'aichat_history_preview_mode=bottom-panel';

    const sidebarSearch = document.getElementById('sidebarSearch') as HTMLInputElement | null;
    expect(sidebarSearch).not.toBeNull();
    sidebarSearch!.value = 'この画像';
    sidebarSearch!.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const resultItem = document.querySelector('.sidebar-result-item .result-swipe-inner') as HTMLElement | null;
    expect(resultItem, '検索結果アイテムがDOMに描画されていない').not.toBeNull();
    resultItem!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    const resultsPanel = document.getElementById('resultsPanel');
    expect(resultsPanel, 'resultsPanelが存在しない').not.toBeNull();
    expect(resultsPanel!.classList.contains('open'), '下部パネルが開いていない').toBe(true);

    const img = document.querySelector('#resultsPanelQ img.chat-bubble-image') as HTMLImageElement | null;
    expect(img, '下部パネルの質問欄に添付画像のimgタグが見つからない').not.toBeNull();
    expect(img!.getAttribute('src')).toBe(imageDataUrl);
  });
});
