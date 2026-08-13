// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
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

describe('/api/aichat/shares系一覧APIがimage_data_urlを欠かさず返す(詳細プレビューモーダルへ直接渡される行のため)', () => {
  // 対象: search/by-date/by-keyword はクライアントの currentResults にそのまま入り、
  // showHistoryPreview()経由でshowHistoryModal(r)へ再フェッチなしで直接渡される。
  // /api/aichat/shares/:id のような単体フェッチ経路だけimage_data_urlを直しても、
  // これら一覧系のSELECTが取り忘れるとプレビューモーダルの画像は表示されないまま
  // (実際に発生した回帰)。SELECT文にimage_data_urlが含まれることを機械的に保証する。
  const src = readFileSync(`${__dirname}/index.ts`, 'utf-8');

  it('searchAiChatShares()のSELECTがimage_data_urlを含む(正規化テーブルaichat_imagesとのJOIN経由)', () => {
    const idx = src.indexOf('export async function searchAiChatShares(');
    const block = src.slice(idx, idx + 1200);
    expect(block).toContain('s.access_count, s.question_hash');
    expect(block).toContain('COALESCE(img.image_data_url, s.image_data_url) AS image_data_url');
    expect(block).toContain('LEFT JOIN aichat_images img ON img.id = s.image_id');
  });

  it('/api/aichat/shares/by-dateのSELECTがimage_data_urlを含む(正規化テーブルaichat_imagesとのJOIN経由)', () => {
    const idx = src.indexOf("app.get('/api/aichat/shares/by-date'");
    const block = src.slice(idx, idx + 900);
    expect(block).toContain('s.access_count, s.question_hash');
    expect(block).toContain('COALESCE(img.image_data_url, s.image_data_url) AS image_data_url');
    expect(block).toContain('LEFT JOIN aichat_images img ON img.id = s.image_id');
  });

  it('/api/aichat/shares/by-keywordのSELECTが両分岐(topicあり/なし)ともimage_data_urlを含む(正規化テーブルaichat_imagesとのJOIN経由)', () => {
    const idx = src.indexOf("app.get('/api/aichat/shares/by-keyword'");
    const block = src.slice(idx, idx + 1900);
    const joinCount = (block.match(/LEFT JOIN aichat_images img ON img\.id = s\.image_id/g) || []).length;
    expect(joinCount).toBe(2);
    const coalesceCount = (block.match(/COALESCE\(img\.image_data_url, s\.image_data_url\) AS image_data_url/g) || []).length;
    expect(coalesceCount).toBe(2);
  });

  it('/api/aichat/shares/:id (単体フェッチ)のSELECTもimage_data_urlを含む', () => {
    const idx = src.indexOf("app.get('/api/aichat/shares/:id'");
    const block = src.slice(idx, idx + 700);
    expect(block).toContain('image_data_url');
  });
});

describe('/aichat ページ: 下部パネル表示モード(showResultsPanel)でも添付画像を表示する', () => {
  // 対象: aichat_history_preview_mode Cookieが'bottom-panel'のユーザー向けの
  // 別プレビューUI(showResultsPanel)。historyModalとは完全に別のDOM・別関数
  // のため、historyModal側だけ直しても下部パネル利用者には画像が出ない。
  const html = buildPage();

  it('showResultsPanel()がr.image_data_urlありならchat-bubble-imageを質問欄に追加する', () => {
    const idx = html.indexOf('function showResultsPanel(r, keyword)');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 700);
    expect(block).toContain("resultsPanelImg.className = 'chat-bubble-image';");
    expect(block).toContain('resultsPanelImg.src = r.image_data_url;');
    expect(block).toContain('resultsPanelQ.appendChild(resultsPanelImg);');
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
