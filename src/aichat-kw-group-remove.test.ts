import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('大分類から分類カテゴリを削除する機能: モジュール変数', () => {
  it('kwRemoveFromCatId モジュール変数が宣言されている', () => {
    const html = buildPage();
    expect(html).toContain('kwRemoveFromCatId');
  });

  it('kwRemoveFromCatName モジュール変数が宣言されている', () => {
    const html = buildPage();
    expect(html).toContain('kwRemoveFromCatName');
  });
});

describe('大分類から分類カテゴリを削除する機能: catEl クリックハンドラ', () => {
  it('catEl クリック時に selectedGroupId && selectedCats[catId] の分岐がある', () => {
    const html = buildPage();
    const idx = html.indexOf("catEl.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1000);
    expect(fn).toContain('kwRemoveFromCatId');
  });

  it('catEl クリック時にリムーブモードで renderKwCatGroupList に ownerGroupId を渡す', () => {
    const html = buildPage();
    const idx = html.indexOf("catEl.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1000);
    expect(fn).toContain('selectedGroupId');
    expect(fn).toContain('renderKwCatGroupList');
  });
});

describe('大分類から分類カテゴリを削除する機能: renderKwCatGroupList', () => {
  it('renderKwCatGroupList が ownerGroupId パラメータを持つ', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwCatGroupList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 100);
    expect(fn).toContain('ownerGroupId');
  });

  it('kwCatGroupRemoveBtn が renderKwCatGroupList 内に存在する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwCatGroupList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('kwCatGroupRemoveBtn');
  });

  it('「この大分類から削除する」ボタンテキストが含まれる', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwCatGroupList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('この大分類から削除する');
  });

  it('削除確認メッセージ「を大分類カテゴリから削除します」が含まれる', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwCatGroupList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 9000);
    expect(fn).toContain('を大分類カテゴリから削除します');
  });

  it('remove-category API エンドポイントが呼ばれる', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwCatGroupList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 9000);
    expect(fn).toContain('remove-category');
  });

  it('削除成功後に kwCatGroupModal を閉じる', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwCatGroupList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 9000);
    const removeCatIdx = fn.indexOf('remove-category');
    expect(removeCatIdx).toBeGreaterThan(-1);
    const closeIdx = fn.indexOf("kwCatGroupModal.classList.remove('open')", removeCatIdx);
    expect(closeIdx).toBeGreaterThan(-1);
  });

  it('削除成功後に renderKwClassifyList を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwCatGroupList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 9000);
    const removeCatIdx = fn.indexOf('remove-category');
    expect(removeCatIdx).toBeGreaterThan(-1);
    const renderIdx = fn.indexOf('renderKwClassifyList', removeCatIdx);
    expect(renderIdx).toBeGreaterThan(-1);
  });

  it('「はい」「いいえ」ボタンが確認ダイアログに含まれる', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwCatGroupList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 9000);
    const confirmIdx = fn.indexOf('を大分類カテゴリから削除します');
    expect(confirmIdx).toBeGreaterThan(-1);
    const confirmBlock = fn.slice(confirmIdx, confirmIdx + 500);
    expect(confirmBlock).toContain('はい');
    expect(confirmBlock).toContain('いいえ');
  });
});

describe('大分類から分類カテゴリを削除する機能: backend API', () => {
  it('index.ts に remove-category エンドポイントがある', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    expect(src).toContain('remove-category');
  });

  it('index.ts の remove-category が category_id を受け取る', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    const idx = src.indexOf('remove-category');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 600);
    expect(snippet).toContain('category_id');
  });
});
