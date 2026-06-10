import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('キーワード分類: 分類決定後のカテゴリ選択状態保持', () => {
  it('selectedCats が renderKwClassifyList 関数の外で宣言されている', () => {
    const html = buildPage();
    const renderIdx = html.indexOf('function renderKwClassifyList');
    expect(renderIdx).toBeGreaterThan(-1);
    const selectedIdx = html.lastIndexOf('var selectedCats', renderIdx);
    expect(selectedIdx).toBeGreaterThan(-1);
  });

  it('applyKwBadgeColors が renderKwClassifyList 関数の外で宣言されている', () => {
    const html = buildPage();
    const renderIdx = html.indexOf('function renderKwClassifyList');
    expect(renderIdx).toBeGreaterThan(-1);
    const applyIdx = html.lastIndexOf('function applyKwBadgeColors', renderIdx);
    expect(applyIdx).toBeGreaterThan(-1);
  });

  it('openKwClassifyList が selectedCats をリセットする', () => {
    const html = buildPage();
    const idx = html.indexOf('function openKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 300);
    expect(fn).toContain('selectedCats');
  });

  it('renderKwClassifyList 完了後に applyKwBadgeColors を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 5000);
    expect(fn).toContain('applyKwBadgeColors()');
  });

  it('applyKwBadgeColors が kw-cat-summary-badge のアクティブ状態も復元する', () => {
    const html = buildPage();
    const idx = html.indexOf('function applyKwBadgeColors');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1800);
    expect(fn).toContain('kw-cat-summary-badge');
    expect(fn).toContain('kw-cat-badge-active');
  });

  it('decideBtn が分類決定後に renderKwClassifyList を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf("decideBtn.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 2500);
    expect(snippet).toContain('renderKwClassifyList');
  });
});
