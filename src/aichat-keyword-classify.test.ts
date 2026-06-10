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
// ナビバーボタン
// ===========================================================
describe('キーワード分類: ナビバーボタン', () => {
  it('kwClassifyBtn が HTML に含まれる', () => {
    expect(buildPage()).toContain('kwClassifyBtn');
  });

  it('🔑分類 テキストが含まれる', () => {
    expect(buildPage()).toContain('🔑分類');
  });
});

// ===========================================================
// キーワード一覧モーダル
// ===========================================================
describe('キーワード分類: キーワード一覧モーダル', () => {
  it('kwClassifyListModal が HTML に含まれる', () => {
    expect(buildPage()).toContain('kwClassifyListModal');
  });

  it('kwClassifyListBody が HTML に含まれる', () => {
    expect(buildPage()).toContain('kwClassifyListBody');
  });

  it('/api/aichat/all-keywords を呼ぶ', () => {
    expect(buildPage()).toContain('/api/aichat/all-keywords');
  });

  it('kwClassifyListModal が getNextZ を使う', () => {
    const html = buildPage();
    const idx = html.indexOf('function openKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('getNextZ');
  });
});

// ===========================================================
// キーワード分類モーダル (第2モーダル)
// ===========================================================
describe('キーワード分類: 分類モーダル', () => {
  it('openKwClassifyModal 関数が含まれる', () => {
    expect(buildPage()).toContain('openKwClassifyModal');
  });

  it('/api/aichat/keyword-categories を呼ぶ', () => {
    expect(buildPage()).toContain('/api/aichat/keyword-categories');
  });

  it('/api/aichat/keyword-category-map を呼ぶ', () => {
    expect(buildPage()).toContain('/api/aichat/keyword-category-map');
  });

  it('openKwClassifyModal が getNextZ を使う', () => {
    const html = buildPage();
    const idx = html.indexOf('function openKwClassifyModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('getNextZ');
  });
});

// ===========================================================
// カテゴリ登録フロー
// ===========================================================
describe('キーワード分類: カテゴリ登録フロー', () => {
  it('POST /api/aichat/keyword-categories を呼ぶコードがある', () => {
    const html = buildPage();
    // POST fetch は GET fetch より後に現れるため lastIndexOf で探す
    const idx = html.lastIndexOf("/api/aichat/keyword-categories'");
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(Math.max(0, idx - 200), idx + 100);
    expect(snippet).toContain('POST');
  });

  it('分類決定ボタンのテキストが含まれる', () => {
    expect(buildPage()).toContain('分類決定');
  });

  it('登録ボタンのテキストが含まれる', () => {
    expect(buildPage()).toContain('登録');
  });

  it('POST /api/aichat/keyword-category-map を呼ぶコードがある', () => {
    const html = buildPage();
    const idx = html.indexOf('/api/aichat/keyword-category-map');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(Math.max(0, idx - 200), idx + 100);
    expect(snippet).toContain('POST');
  });
});

// ===========================================================
// getNextZ への登録
// ===========================================================
describe('キーワード分類: getNextZ staticZDefaults 登録', () => {
  it('kwClassifyListModal が staticZDefaults に登録されている', () => {
    const html = buildPage();
    const idx = html.indexOf('staticZDefaults');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 600);
    expect(snippet).toContain('kwClassifyListModal');
  });
});
