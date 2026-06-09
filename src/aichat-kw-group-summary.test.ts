import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('キーワード分類モーダル: 大分類サマリー行', () => {
  it('renderKwClassifyList が /api/aichat/category-groups をフェッチする', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1200);
    expect(fn).toContain('category-groups');
  });

  it('renderKwClassifyList が 大分類 : テキストを生成するコードを持つ', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    const fn = html.slice(idx, idx + 3500);
    expect(fn).toContain('大分類');
  });

  it('renderKwClassifyList が groups データを kw_count でソートするコードを持つ', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    const fn = html.slice(idx, idx + 3500);
    expect(fn).toContain('kw_count');
  });

  it('グループバッジに kw-group-summary-badge クラスを使う', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    const fn = html.slice(idx, idx + 3500);
    expect(fn).toContain('kw-group-summary-badge');
  });

  it('大分類バッジが group_name を表示するコードを持つ', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    const fn = html.slice(idx, idx + 3500);
    expect(fn).toContain('group_name');
  });

  it('大分類バッジが kw_count をカウント表示するコードを持つ', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    const fn = html.slice(idx, idx + 3500);
    const groupBadgeIdx = fn.indexOf('kw-group-summary-badge');
    expect(groupBadgeIdx).toBeGreaterThan(-1);
    const snippet = fn.slice(groupBadgeIdx, groupBadgeIdx + 400);
    expect(snippet).toContain('kw_count');
  });

  it('/api/aichat/category-groups が kw_count を返す', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    const idx = src.indexOf("app.get('/api/aichat/category-groups'");
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 800);
    expect(snippet).toContain('kw_count');
  });

  it('/api/aichat/category-groups が json_each で category_ids を展開する', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    const idx = src.indexOf("app.get('/api/aichat/category-groups'");
    const snippet = src.slice(idx, idx + 800);
    expect(snippet).toContain('json_each');
  });
});
