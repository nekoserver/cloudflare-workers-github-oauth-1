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
