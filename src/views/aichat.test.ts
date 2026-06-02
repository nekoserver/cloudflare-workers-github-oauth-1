import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './aichat';

const minimalUser = {
  username: 'testuser',
  aiChatModel: 'claude-sonnet-4-6',
};

describe('AIチャット詳細パネル: Markdownプレビュー', () => {
  it('parseMd 関数が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('function parseMd(');
  });

  it('showResultsPanel が回答を innerHTML で描画する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function showResultsPanel(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 400);
    expect(fnBody).toContain('resultsPanelA.innerHTML');
    expect(fnBody).not.toContain('resultsPanelA.textContent');
  });

  it('showResultsPanel が parseMd を呼び出す', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function showResultsPanel(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 400);
    expect(fnBody).toContain('parseMd(');
  });

  it('Markdown用CSSクラスが results-col-text に適用される', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('results-col-text');
    expect(html).toContain('preview-area');
  });
});

describe('AIチャット詳細プレビューモーダル: 吹き出し配置', () => {
  it('モーダル内ユーザー吹き出しが左寄せ（flex-start）になっている', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('.history-modal .chat-bubble.user');
    expect(html).toContain('align-self: flex-start');
  });

  it('モーダル内アシスタント吹き出しが右寄せ（flex-end）になっている', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('.history-modal .chat-bubble.assistant');
    expect(html).toContain('align-self: flex-end');
  });
});

describe('AIチャット詳細プレビューモーダル: 日付リンク', () => {
  it('historyModalDateLink 要素が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="historyModalDateLink"');
  });

  it('history-modal-date-link CSS が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('.history-modal-date-link');
  });

  it('historyModalDateLink のクリックハンドラが存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('historyModalDateLink.addEventListener');
  });

  it('日付リンクのクリックでサイドバーを開く処理が含まれる', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('historyModalDateLink.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 900);
    expect(fnBody).toContain('loadCalendar');
    expect(fnBody).toContain('doDateLoad');
  });
});

describe('AIチャットサイドバー: フォーカスなし・ハイライトなし', () => {
  it('renderSidebarResults に selected クラスを付与するコードがない', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSidebarResults(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 1500);
    expect(fnBody).not.toContain("' selected'");
    expect(fnBody).not.toContain('" selected"');
  });

  it('renderSidebarResults に highlight-origin クラスを付与するコードがない', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSidebarResults(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 1500);
    expect(fnBody).not.toContain('highlight-origin');
    expect(fnBody).not.toContain('sidebarHighlightId');
  });

  it('サイドバー項目クリックで selectedIdx を変更してから renderSidebarResults を呼ばない', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("'click', function()");
    expect(idx).toBeGreaterThan(-1);
    const clickBody = html.slice(idx, idx + 300);
    expect(clickBody).not.toContain('selectedIdx = i');
  });
});

describe('AIチャットサイドバー: スワイプ削除', () => {
  it('削除確認ダイアログの HTML が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="deleteConfirmOverlay"');
    expect(html).toContain('id="deleteConfirmOk"');
    expect(html).toContain('id="deleteConfirmCancel"');
  });

  it('result-delete-btn CSS が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('.result-delete-btn');
  });

  it('delete-confirm-overlay CSS が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('.delete-confirm-overlay');
  });

  it('result-swipe-inner CSS が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('.result-swipe-inner');
  });

  it('addSwipeBehavior 関数が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('function addSwipeBehavior(');
  });

  it('削除 API が DELETE メソッドで呼ばれる', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('deleteConfirmOk.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 400);
    expect(fnBody).toContain("method: 'DELETE'");
    expect(fnBody).toContain('/api/aichat/shares/');
  });

  it('animateDeleteItem 関数が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('function animateDeleteItem(');
  });

  it('renderSidebarResults が result-delete-btn と result-swipe-inner を生成する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSidebarResults(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 2000);
    expect(fnBody).toContain('result-delete-btn');
    expect(fnBody).toContain('result-swipe-inner');
    expect(html).toContain('addSwipeBehavior(item, inner)');
  });

  it('削除ボタンはデフォルト opacity:0 で swipe-open 時のみ opacity:1 になる', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('opacity: 0');
    expect(html).toContain('.sidebar-result-item.swipe-open .result-delete-btn');
  });
});

describe('AIチャットサイドバー: デフォルトプレビューモードと下パネル', () => {
  it('getHistoryPreviewMode のデフォルトが center-modal', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function getHistoryPreviewMode(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 200);
    expect(fnBody).toContain("'center-modal'");
    expect(fnBody).not.toContain("'bottom-panel'");
  });

  it('resultsPanelToModal ボタンが存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="resultsPanelToModal"');
  });

  it('resultsPanelToModal クリックで center-modal Cookie を保存してパネルを閉じる', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("resultsPanelToModal').addEventListener");
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 300);
    expect(snippet).toContain('center-modal');
    expect(snippet).toContain('closeResultsPanel');
  });
});

describe('AIチャットサイドバー: 検索キーワードハイライト', () => {
  it('kw-highlight CSS クラスが存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('.kw-highlight');
  });

  it('applyKeywordHighlight 関数が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('function applyKeywordHighlight(');
  });

  it('showHistoryModal がキーワード引数を受け取りハイライトを適用する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function showHistoryModal(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 500);
    expect(fnBody).toContain('keyword');
    expect(fnBody).toContain('applyKeywordHighlight');
  });

  it('showResultsPanel がキーワード引数を受け取りハイライトを適用する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function showResultsPanel(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 400);
    expect(fnBody).toContain('keyword');
    expect(fnBody).toContain('applyKeywordHighlight');
  });

  it('showHistoryPreview が search モード時に search-log API を POST 呼ぶ', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function showHistoryPreview(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 600);
    expect(fnBody).toContain('/api/aichat/search-log');
    expect(fnBody).toContain("method: 'POST'");
  });

  it('showHistoryPreview が keyword を showHistoryModal または showResultsPanel に渡す', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function showHistoryPreview(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 600);
    expect(fnBody).toContain('showHistoryModal(r, keyword)');
    expect(fnBody).toContain('showResultsPanel(r, keyword)');
  });
});
