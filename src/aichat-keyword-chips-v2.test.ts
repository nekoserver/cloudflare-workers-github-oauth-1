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
// API: share-keywords が count を返すこと
// ===========================================================
describe('share-keywords API: countフィールド', () => {
  it('APIが SUM(select_count) を集計して count フィールドを返すこと', () => {
    // index.ts側の確認はintegrationテストで行う。ここではビュー側の構造を確認する
    // historyModalKeywordsFromDB が { keyword, count } を扱う形になっていること
    const html = buildPage();
    // renderKeywordChips 内で .count を参照していること
    const idx = html.indexOf('function renderKeywordChips');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1200);
    expect(fn).toContain('.count');
  });
});

// ===========================================================
// バッジ表記: "keyword (count)" 形式
// ===========================================================
describe('キーワードチップ: バッジ表記', () => {
  it('renderKeywordChips が keyword と count を両方使う', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKeywordChips');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1200);
    expect(fn).toContain('.keyword');
    expect(fn).toContain('.count');
  });

  it('バッジに "(count)" 形式の括弧表記が含まれる', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKeywordChips');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1200);
    // "(数)" のような括弧表記テンプレートがあること
    expect(fn).toMatch(/\(.*\.count.*\)/);
  });
});

// ===========================================================
// バッジのクリックでハイライト＆スクロール
// ===========================================================
describe('キーワードチップ: タップ時の動作', () => {
  it('renderKeywordChips がクリックリスナーを登録する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKeywordChips');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2400);
    expect(fn).toContain('addEventListener');
    expect(fn).toContain('click');
  });

  it('クリック時に clearKeywordHighlights を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKeywordChips');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2400);
    expect(fn).toContain('clearKeywordHighlights');
  });

  it('クリック時に applyKeywordHighlight を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKeywordChips');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2400);
    expect(fn).toContain('applyKeywordHighlight');
  });

  it('クリック時に scrollIntoView を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKeywordChips');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2400);
    expect(fn).toContain('scrollIntoView');
  });
});

// ===========================================================
// buildAllKeywords が { keyword, count } 配列を正しく扱う
// ===========================================================
describe('buildAllKeywords: 型変更後の互換性', () => {
  it('buildAllKeywords が .keyword プロパティを参照する', () => {
    const html = buildPage();
    const idx = html.indexOf('function buildAllKeywords');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('.keyword');
  });
});

// ===========================================================
// historyModalKeywordChips 要素の存在
// ===========================================================
describe('HTML構造: historyModalKeywordChips', () => {
  it('historyModalKeywordChips 要素が存在する', () => {
    expect(buildPage()).toContain('historyModalKeywordChips');
  });
});
