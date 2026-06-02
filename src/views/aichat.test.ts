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
    expect(fnBody).toContain('sidebarHighlightId');
    expect(fnBody).toContain('loadCalendar');
    expect(fnBody).toContain('doDateLoad');
  });
});

describe('AIチャット詳細プレビューモーダル: サイドバーハイライト', () => {
  it('highlight-origin CSSクラスが存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('highlight-origin');
  });

  it('highlight-origin の背景が薄緑色', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('.sidebar-result-item.highlight-origin');
    expect(idx).toBeGreaterThan(-1);
    const rule = html.slice(idx, idx + 200);
    expect(rule).toContain('rgba(72,187,120');
  });

  it('renderSidebarResults が highlight-origin クラスを付与する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSidebarResults(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 600);
    expect(fnBody).toContain('highlight-origin');
    expect(fnBody).toContain('sidebarHighlightId');
  });
});
