// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getAiChatPage } from './views/aichat';

describe('左サイドパネルのCodex色', () => {
  it('保存したcodexモデル色を質問行の左罫線と色丸凡例で共有する', () => {
    const html = getAiChatPage({ username: 'test', aiChatModel: 'other', modelColors: { other: '#4f46e5', codex: '#0ea5e9' } });
    const colors = JSON.parse(html.match(/var MODEL_COLORS = (.*);/)![1]);
    const source = html.slice(html.indexOf('    function renderSidebarResults()'), html.indexOf('    // ===== カレンダーヒートマップ'));
    const sidebar = document.createElement('div');
    new Function('document', 'MODEL_COLORS', 'sidebarResults', 'currentResults', 'sidebarSubqueries', 'closeSwipeOpen', 'addSwipeBehavior', source + '\nrenderSidebarResults();')(
      document, colors, sidebar,
      [{ id: 'share', question: '質問本文', model: 'codex', created_at: '2026-10-07T00:00:00' }],
      new Set(), () => {}, () => {},
    );
    const row = sidebar.querySelector<HTMLElement>('.sidebar-result-item')!;
    expect(row.style.borderLeftColor).toBe('rgb(14, 165, 233)');
    expect(row.querySelector('.result-model-label')?.textContent).toBe('codex');
    expect(row.querySelector('.result-q')?.textContent).toBe('質問本文');
    expect(JSON.parse(html.match(/var MODEL_LIST = (.*);/)![1])).toContainEqual({ value: 'codex', label: 'codex', commandOnly: true });
  });
});
