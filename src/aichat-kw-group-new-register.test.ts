import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('大分類カテゴリ新規登録後の再描画', () => {
  it('kwCatGroupConfirm の POST 成功後に renderKwClassifyList を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf("getElementById('kwCatGroupConfirm')");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1400);
    const thenIdx = fn.indexOf('.then(function(d)');
    expect(thenIdx).toBeGreaterThan(-1);
    const thenBlock = fn.slice(thenIdx, thenIdx + 600);
    expect(thenBlock).toContain('renderKwClassifyList');
  });

  it('kwCatGroupConfirm の POST 成功後に selectedGroupId を新グループ id に切り替える', () => {
    const html = buildPage();
    const idx = html.indexOf("getElementById('kwCatGroupConfirm')");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1400);
    const thenIdx = fn.indexOf('.then(function(d)');
    expect(thenIdx).toBeGreaterThan(-1);
    const thenBlock = fn.slice(thenIdx, thenIdx + 600);
    expect(thenBlock).toContain('selectedGroupId = d.id');
  });

  it('kwCatGroupConfirm の POST 成功後にモーダルを閉じてから再描画する', () => {
    const html = buildPage();
    const idx = html.indexOf("getElementById('kwCatGroupConfirm')");
    const fn = html.slice(idx, idx + 1400);
    const thenIdx = fn.indexOf('.then(function(d)');
    const thenBlock = fn.slice(thenIdx, thenIdx + 600);
    const closeIdx = thenBlock.indexOf('kwCatGroupModal.classList.remove');
    const renderIdx = thenBlock.indexOf('renderKwClassifyList');
    expect(closeIdx).toBeGreaterThan(-1);
    expect(renderIdx).toBeGreaterThan(-1);
    expect(renderIdx).toBeGreaterThan(closeIdx);
  });
});
