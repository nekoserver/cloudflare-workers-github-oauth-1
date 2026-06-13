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
// バッジの色分け: CSSクラスで実現
// ===========================================================
describe('キーワードチップ: 色分け (CSSクラス)', () => {
  it('CSS に hist-kw-chip-cls クラスが定義されている', () => {
    const html = buildPage();
    expect(html).toContain('hist-kw-chip-cls');
    expect(html).toContain('--kw-pal-cls');
  });

  it('CSS に hist-kw-chip-unc クラスが定義されている', () => {
    const html = buildPage();
    expect(html).toContain('hist-kw-chip-unc');
    expect(html).toContain('--kw-pal-unc');
  });

  it('CSS に hist-kw-chip-active クラスが定義されている', () => {
    const html = buildPage();
    expect(html).toContain('hist-kw-chip-active');
    expect(html).toContain('--kw-pal-act');
  });

  it('renderKeywordChips が hist-kw-chip クラスを使う', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKeywordChips');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2200);
    expect(fn).toContain('hist-kw-chip');
    expect(fn).toContain('hist-kw-chip-cls');
    expect(fn).toContain('hist-kw-chip-unc');
  });

  it('applyKwPaletteToDom が --kw-pal-act を CSS 変数にセットする', () => {
    const html = buildPage();
    const idx = html.indexOf('function applyKwPaletteToDom');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 750);
    expect(fn).toContain('--kw-pal-act');
  });
});

// ===========================================================
// 選択中チップのアクティブ表示
// ===========================================================
describe('キーワードチップ: アクティブ状態', () => {
  it('historyModalActiveChipKeyword 変数が存在する', () => {
    expect(buildPage()).toContain('historyModalActiveChipKeyword');
  });

  it('クリック時に hist-kw-chip-active クラスを付与する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKeywordChips');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2200);
    expect(fn).toContain('hist-kw-chip-active');
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
