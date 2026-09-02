import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './aichat';

const minimalUser = {
  username: 'testuser',
  aiChatModel: 'claude-sonnet-4-6',
};

// 対象: AIチャットページ(.chat-wrapper)の表示幅。中央寄せ(margin: 0 auto)を
// 維持したまま、固定640pxから画面幅の80%へ広げる。
describe('AIチャットの出力幅', () => {
  it('.chat-wrapperのmax-widthが80%で、中央寄せ(margin: 0 auto)を維持している', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('.chat-wrapper {');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, html.indexOf('}', idx));
    expect(block).toContain('max-width: 80%');
    expect(block).toContain('margin: 0 auto');
    expect(block).not.toContain('640px');
  });
});
