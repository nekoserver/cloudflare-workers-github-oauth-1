import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('大分類バッジタップ: カテゴリ選択状態の一括切替', () => {
  it('kw-group-summary-badge に data-cat-ids 属性がある', () => {
    const html = buildPage();
    const idx = html.indexOf('class="kw-group-summary-badge"');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 200);
    expect(snippet).toContain('data-cat-ids');
  });

  it('kw-group-summary-badge に cursor:pointer がある', () => {
    const html = buildPage();
    const idx = html.indexOf('class="kw-group-summary-badge"');
    const snippet = html.slice(idx, idx + 350);
    expect(snippet).toContain('cursor:pointer');
  });

  it("querySelectorAll('.kw-group-summary-badge') にクリックリスナーが追加される", () => {
    const html = buildPage();
    const idx = html.indexOf("querySelectorAll('.kw-group-summary-badge')");
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 120);
    expect(snippet).toContain('addEventListener');
  });

  it('大分類クリック時に selectedCats がリセットされる', () => {
    const html = buildPage();
    const idx = html.indexOf("querySelectorAll('.kw-group-summary-badge')");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 500);
    expect(fn).toContain('selectedCats = {}');
  });

  it('大分類クリック時にグループの catIds を selectedCats に設定する', () => {
    const html = buildPage();
    const idx = html.indexOf("querySelectorAll('.kw-group-summary-badge')");
    const fn = html.slice(idx, idx + 500);
    expect(fn).toContain('catIds');
    expect(fn).toContain('selectedCats[String(id)]');
  });

  it('大分類クリック時に applyKwBadgeColors を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf("querySelectorAll('.kw-group-summary-badge')");
    const fn = html.slice(idx, idx + 500);
    expect(fn).toContain('applyKwBadgeColors()');
  });

  it('data-cat-ids を JSON.parse して catIds を取り出す', () => {
    const html = buildPage();
    const idx = html.indexOf("querySelectorAll('.kw-group-summary-badge')");
    const fn = html.slice(idx, idx + 500);
    expect(fn).toContain('JSON.parse');
    expect(fn).toContain('catIds');
  });
});
