import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('カレンダー表示: レイアウト修正', () => {
  it('.sidebar-results に min-height: 0 が設定されている', () => {
    const html = buildPage();
    const idx = html.indexOf('.sidebar-results {');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 200);
    expect(snippet).toContain('min-height: 0');
  });

  it('loadCalendar の catch ブロックで renderCalendar を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('function loadCalendar');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('.catch');
    expect(fn).toContain('renderCalendar');
    // catch の中に renderCalendar があることを確認
    const catchIdx = fn.indexOf('.catch');
    const afterCatch = fn.slice(catchIdx);
    expect(afterCatch).toContain('renderCalendar');
  });
});
