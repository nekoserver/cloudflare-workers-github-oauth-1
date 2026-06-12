import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};

function buildPage(): string {
  return getAiChatPage(minimalUser);
}

// ===========================================================
// モーダル開いた時点でパネルが開いていること
// ===========================================================
describe('キーワードチップパネル: 初期表示', () => {
  it('showHistoryModal が historyModalChipsPinned を true にセットする', () => {
    const html = buildPage();
    const idx = html.indexOf('function showHistoryModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('historyModalChipsPinned = true');
  });
});

// ===========================================================
// API: is_classified フィールド
// ===========================================================
describe('share-keywords API: is_classified', () => {
  it('renderKeywordChips が is_classified を参照する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKeywordChips');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2200);
    expect(fn).toContain('is_classified');
  });
});

// ===========================================================
// バッジの色分け
// ===========================================================
describe('キーワードチップ: 色分け', () => {
  it('分類済みキーワードに --kw-pal-cls を使う', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKeywordChips');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2200);
    expect(fn).toContain('--kw-pal-cls');
  });

  it('未分類キーワードに --kw-pal-unc を使う', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKeywordChips');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2200);
    expect(fn).toContain('--kw-pal-unc');
  });
});

// ===========================================================
// バッジ間の余白: 1px
// ===========================================================
describe('キーワードチップ: gap', () => {
  it('historyModalKeywordChips の gap が 1px', () => {
    const html = buildPage();
    const idx = html.indexOf('historyModalKeywordChips');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 300);
    expect(snippet).toContain('gap:1px');
  });
});
