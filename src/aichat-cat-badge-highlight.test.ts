import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};
function buildPage(): string { return getAiChatPage(minimalUser); }

// ===========================================================
// カテゴリバッジタップ → キーワードバッジ色変更
// ===========================================================
describe('カテゴリバッジタップ: キーワードバッジ色変更', () => {
  it('renderKwClassifyList のカテゴリバッジに data-cat-id 属性がある', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2000);
    expect(fn).toContain('data-cat-id');
  });

  it('renderKwClassifyList のキーワードバッジに data-cat-id 属性が付与される変数がある', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    // catIdAttr 変数に data-cat-id が含まれ、kw-classify-kw-badge に結合される
    const fn = html.slice(idx, idx + 4000);
    expect(fn).toContain('catIdAttr');
    expect(fn).toContain('data-cat-id');
  });

  it('renderKwClassifyList がカテゴリバッジにクリックリスナーを追加する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    // カテゴリバッジへの addEventListener または querySelectorAll があること
    expect(fn).toContain('kw-cat-summary-badge');
    expect(fn).toContain('addEventListener');
  });

  it('カテゴリバッジクリック時に kw-classify-kw-badge の背景色を変えるコードがある', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 4000);
    // catId を参照して背景色を適用するコードがある
    expect(fn).toContain('catId');
    // background に cat color を適用する
    expect(fn).toContain('backgroundColor');
  });
});

// ===========================================================
// index.ts: all-keywords が category_id を返す
// ===========================================================
describe('backend: all-keywords に category_id が含まれる', () => {
  it('index.ts の all-keywords クエリに category_id が含まれる', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    const idx = src.indexOf('/api/aichat/all-keywords');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 800);
    expect(snippet).toContain('category_id');
  });
});
