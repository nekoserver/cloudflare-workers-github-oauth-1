import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};
function buildPage(): string { return getAiChatPage(minimalUser); }

describe('キーワード分類モーダル: 中分類カテゴリの開閉トグル', () => {
  it('中分類の段に ▲▼ のトグルボタンがある', () => {
    const html = buildPage();
    expect(html).toContain('id="kwMidCatToggle"');
    const idx = html.indexOf('id="kwMidCatToggle"');
    expect(html.slice(idx, idx + 400)).toContain('▲▼');
  });

  it('中分類バッジは開閉対象の入れ物に包まれる', () => {
    const html = buildPage();
    expect(html).toContain('id="kwMidCatBadges"');
    const wrapIdx = html.indexOf('id="kwMidCatBadges"');
    const badgeIdx = html.indexOf('kw-cat-summary-badge', wrapIdx);
    expect(badgeIdx).toBeGreaterThan(wrapIdx);
  });

  it('トグルは状態変数を反転し、入れ物の表示だけを切り替える', () => {
    const html = buildPage();
    expect(html).toContain('kwMidCatCollapsed');
    const idx = html.indexOf("getElementById('kwMidCatToggle')");
    expect(idx).toBeGreaterThan(-1);
    const handler = html.slice(idx, idx + 600);
    expect(handler).toContain("getElementById('kwMidCatBadges')");
    expect(handler).toContain('kwMidCatCollapsed = !kwMidCatCollapsed');
    expect(handler).toContain("? 'none' : ''");
  });

  it('再描画しても開閉状態が保たれるよう、描画側が状態変数を見る', () => {
    const html = buildPage();
    const idx = html.indexOf('id="kwMidCatBadges"');
    expect(html.slice(Math.max(0, idx - 200), idx + 100)).toContain('kwMidCatCollapsed');
  });
});
