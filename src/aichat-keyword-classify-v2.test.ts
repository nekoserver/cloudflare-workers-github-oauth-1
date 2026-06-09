import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};
function buildPage(): string { return getAiChatPage(minimalUser); }

// ===========================================================
// カラーパレット
// ===========================================================
describe('キーワード分類拡張: カラーパレット', () => {
  it('KW_CAT_COLORS が20色以上含まれる', () => {
    const html = buildPage();
    const idx = html.indexOf('KW_CAT_COLORS');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 500);
    // 16進カラーコードが20個以上
    const matches = snippet.match(/#[0-9a-fA-F]{6}/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(20);
  });
});

// ===========================================================
// renderKwClassifyList: カテゴリサマリー上段
// ===========================================================
describe('キーワード分類拡張: renderKwClassifyList', () => {
  it('renderKwClassifyList 関数が存在する', () => {
    expect(buildPage()).toContain('function renderKwClassifyList');
  });

  it('keyword-categories-summary を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 800);
    expect(fn).toContain('/api/aichat/keyword-categories-summary');
  });

  it('all-keywords と categories-summary を Promise.allSettled で並列取得する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 800);
    expect(fn).toContain('Promise.allSettled');
    expect(fn).toContain('/api/aichat/all-keywords');
  });

  it('is_classified のキーワードバッジを kw-kw-classified クラスで描画する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 5000);
    expect(fn).toContain('is_classified');
    expect(fn).toContain('kw-kw-classified');
  });

  it('openKwClassifyList が renderKwClassifyList を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('function openKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 300);
    expect(fn).toContain('renderKwClassifyList');
  });
});

// ===========================================================
// 分類決定後の再描画
// ===========================================================
describe('キーワード分類拡張: 分類決定後の再描画', () => {
  it('keyword-category-map POST 後に renderKwClassifyList を呼ぶ', () => {
    const html = buildPage();
    const idx = html.lastIndexOf('/api/aichat/keyword-category-map');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 1000);
    expect(snippet).toContain('renderKwClassifyList');
  });
});

// ===========================================================
// 色選択スウォッチ
// ===========================================================
describe('キーワード分類拡張: 色選択スウォッチ', () => {
  it('openKwClassifyModal 内に selectedColor 変数がある', () => {
    const html = buildPage();
    const idx = html.indexOf('function openKwClassifyModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2000);
    expect(fn).toContain('selectedColor');
  });

  it('colorRow が openKwClassifyModal 内にある', () => {
    const html = buildPage();
    const idx = html.indexOf('function openKwClassifyModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 4000);
    expect(fn).toContain('colorRow');
  });

  it('カテゴリ登録 POST に color を含む', () => {
    const html = buildPage();
    const idx = html.lastIndexOf('/api/aichat/keyword-categories');
    expect(idx).toBeGreaterThan(-1);
    // POST fetch は URL より後の body に color が含まれる
    const snippet = html.slice(Math.max(0, idx - 200), idx + 400);
    expect(snippet).toContain('color');
    expect(snippet).toContain('POST');
  });
});

// ===========================================================
// カテゴリバッジにカテゴリ色を反映
// ===========================================================
describe('キーワード分類拡張: カテゴリバッジの色', () => {
  it('renderCatBadge が cat.color を使う', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderCatBadge');
    if (idx < 0) {
      // インライン関数の場合は renderCatBadge が openKwClassifyModal 内に埋め込まれている
      const idx2 = html.indexOf('cat.color');
      expect(idx2).toBeGreaterThan(-1);
      return;
    }
    const fn = html.slice(idx, idx + 500);
    expect(fn).toContain('cat.color');
  });
});

// ===========================================================
// index.ts: 新 API エンドポイント
// ===========================================================
describe('キーワード分類拡張: backend API', () => {
  it('index.ts に keyword-categories-summary エンドポイントがある', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    expect(src).toContain('/api/aichat/keyword-categories-summary');
  });

  it('index.ts の all-keywords に is_classified が含まれる', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    const idx = src.indexOf('/api/aichat/all-keywords');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 600);
    expect(snippet).toContain('is_classified');
  });

  it('keyword-categories POST が color を受け取る', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    const idx = src.lastIndexOf('/api/aichat/keyword-categories');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 600);
    expect(snippet).toContain('color');
  });
});
