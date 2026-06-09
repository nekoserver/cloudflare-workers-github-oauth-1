import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('大分類バッジ: トグルON/OFF状態', () => {
  it('selectedGroupId がモジュールスコープで宣言されている', () => {
    const html = buildPage();
    const renderIdx = html.indexOf('function renderKwClassifyList');
    const idx = html.lastIndexOf('var selectedGroupId', renderIdx);
    expect(idx).toBeGreaterThan(-1);
  });

  it('applyKwGroupBadgeState 関数がモジュールスコープで宣言されている', () => {
    const html = buildPage();
    const renderIdx = html.indexOf('function renderKwClassifyList');
    const idx = html.lastIndexOf('function applyKwGroupBadgeState', renderIdx);
    expect(idx).toBeGreaterThan(-1);
  });

  it('.kw-group-badge-active CSS が定義されている', () => {
    const html = buildPage();
    expect(html).toContain('.kw-group-badge-active');
  });

  it('大分類バッジクリックで selectedGroupId === groupId によるトグル判定がある', () => {
    const html = buildPage();
    const idx = html.indexOf("grpEl.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('selectedGroupId === groupId');
  });

  it('大分類バッジクリック後に applyKwGroupBadgeState を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf("grpEl.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('applyKwGroupBadgeState()');
  });

  it('applyKwGroupBadgeState が kw-group-badge-active を付与・除去する', () => {
    const html = buildPage();
    const idx = html.indexOf('function applyKwGroupBadgeState');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('kw-group-badge-active');
    expect(fn).toContain('selectedGroupId');
  });

  it('openKwClassifyList が selectedGroupId をリセットする', () => {
    const html = buildPage();
    const idx = html.indexOf('function openKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 300);
    expect(fn).toContain('selectedGroupId');
  });
});

describe('大分類ON状態: 未選択カテゴリタップで add-mode', () => {
  it('kwAddToCatId がモジュールスコープで宣言されている', () => {
    const html = buildPage();
    const renderIdx = html.indexOf('function renderKwClassifyList');
    const idx = html.lastIndexOf('var kwAddToCatId', renderIdx);
    expect(idx).toBeGreaterThan(-1);
  });

  it('カテゴリクリックで selectedGroupId && !selectedCats[catId] 条件がある', () => {
    const html = buildPage();
    const idx = html.indexOf("catEl.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('selectedGroupId');
    expect(fn).toContain('selectedCats[catId]');
  });

  it('add-mode で kwAddToCatId がセットされる', () => {
    const html = buildPage();
    const idx = html.indexOf("catEl.addEventListener('click'");
    const fn = html.slice(idx, idx + 1200);
    expect(fn).toContain('kwAddToCatId');
  });

  it('add-mode で kwCatGroupModal を開く', () => {
    const html = buildPage();
    const idx = html.indexOf("catEl.addEventListener('click'");
    const fn = html.slice(idx, idx + 900);
    expect(fn).toContain('kwCatGroupModal');
    expect(fn).toContain('loadKwCatGroups');
  });
});

describe('大分類カテゴリに束ねるモーダル: add-mode 確認ダイアログ', () => {
  it('renderKwCatGroupList が kwAddToCatId をチェックする', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwCatGroupList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 8000);
    expect(fn).toContain('kwAddToCatId');
  });

  it('確認モーダルに「追加登録しますか」テキストがある', () => {
    const html = buildPage();
    expect(html).toContain('追加登録しますか');
  });

  it('確認モーダルに「はい」「いいえ」ボタンがある', () => {
    const html = buildPage();
    const idx = html.indexOf('追加登録しますか');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 500);
    expect(snippet).toContain('はい');
    expect(snippet).toContain('いいえ');
  });

  it('cg-group-btn に data-group-name 属性がある', () => {
    const html = buildPage();
    const idx = html.indexOf('cg-group-btn');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 300);
    expect(snippet).toContain('data-group-name');
  });

  it('「はい」で /add-category エンドポイントをフェッチする', () => {
    const html = buildPage();
    expect(html).toContain('add-category');
  });

  it('追加後に selectedGroupId を追加先グループに切り替える', () => {
    const html = buildPage();
    const idx = html.indexOf('add-category');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 700);
    expect(snippet).toContain('selectedGroupId = groupId');
  });

  it('追加後に renderKwClassifyList を再呼び出しする', () => {
    const html = buildPage();
    const idx = html.indexOf('add-category');
    const snippet = html.slice(idx, idx + 700);
    expect(snippet).toContain('renderKwClassifyList()');
  });

  it('/add-category エンドポイントが backend に存在する', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    expect(src).toContain('/add-category');
  });
});

describe('再描画時の状態同期', () => {
  it('renderKwClassifyList が selectedGroupId に基づき selectedCats を同期する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    const fn = html.slice(idx, idx + 2000);
    expect(fn).toContain('selectedGroupId');
    expect(fn).toContain('activeGroup');
  });
});
