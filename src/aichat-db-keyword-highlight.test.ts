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
// 状態変数
// ===========================================================
describe('DBキーワードハイライト: 状態変数', () => {
  it('historyModalKeywordsFromDB 変数が含まれる', () => {
    expect(buildPage()).toContain('historyModalKeywordsFromDB');
  });
});

// ===========================================================
// showHistoryModal でのキーワード取得
// ===========================================================
describe('DBキーワードハイライト: showHistoryModal でのフェッチ', () => {
  it('showHistoryModal が /api/aichat/share-keywords を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('function showHistoryModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3500);
    expect(fn).toContain('/api/aichat/share-keywords');
  });

  it('showHistoryModal が historyModalKeywordsFromDB をリセットする', () => {
    const html = buildPage();
    const idx = html.indexOf('function showHistoryModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3500);
    expect(fn).toContain('historyModalKeywordsFromDB = []');
  });

  it('share-keywords フェッチ後に updateHighlightToggleBtn を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('/api/aichat/share-keywords');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain('updateHighlightToggleBtn');
  });
});

// ===========================================================
// updateHighlightToggleBtn の DB キーワード考慮
// ===========================================================
describe('DBキーワードハイライト: updateHighlightToggleBtn', () => {
  it('updateHighlightToggleBtn が historyModalKeywordsFromDB を参照する', () => {
    const html = buildPage();
    const idx = html.indexOf('function updateHighlightToggleBtn');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 700);
    expect(fn).toContain('historyModalKeywordsFromDB');
  });

  it('DBキーワードがある場合 opacity 1 を設定する分岐がある', () => {
    const html = buildPage();
    const idx = html.indexOf('function updateHighlightToggleBtn');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 700);
    const dbIdx = fn.indexOf('historyModalKeywordsFromDB');
    expect(dbIdx).toBeGreaterThan(-1);
    const nearby = fn.slice(dbIdx, dbIdx + 200);
    expect(nearby).toContain("'1'");
  });
});

// ===========================================================
// クリックハンドラ: DBキーワードの適用
// ===========================================================
describe('DBキーワードハイライト: クリックハンドラ', () => {
  it('クリック時に historyModalKeywordsFromDB を参照する', () => {
    const html = buildPage();
    const idx = html.indexOf('historyModalHighlightToggleBtn.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('historyModalKeywordsFromDB');
  });

  it('マークなし状態でクリックすると applyKeywordHighlight を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('historyModalHighlightToggleBtn.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('applyKeywordHighlight');
  });
});
