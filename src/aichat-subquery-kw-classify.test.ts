import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};
function buildPage(): string { return getAiChatPage(minimalUser); }

// ===========================================================
// サブクエリ一覧: 分類済みキーワードバッジの中抜き紫スタイル
// ===========================================================
describe('サブクエリ一覧: 分類済みキーワードバッジの中抜き紫スタイル', () => {
  it('openSubqueries が Promise.allSettled で all-keywords を並列取得する', () => {
    const html = buildPage();
    const idx = html.indexOf('function openSubqueries');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 800);
    expect(fn).toContain('Promise.allSettled');
    expect(fn).toContain('/api/aichat/all-keywords');
  });

  it('renderSubqueriesList が分類済みキーワードに kw-kw-classified クラスを使う', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderSubqueriesList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3600);
    expect(fn).toContain('kw-kw-classified');
  });

  it('renderSubqueriesList が is_classified または classifiedSet を参照する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderSubqueriesList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 400);
    const hasClassifiedSet = fn.includes('classifiedSet') || fn.includes('is_classified') || fn.includes('classifiedKws');
    expect(hasClassifiedSet).toBe(true);
  });

  it('renderSubqueriesList が分類済みキーワードに kw-kw-classified クラスを使う（#7c3aed インラインハードコード禁止）', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderSubqueriesList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 5000);
    expect(fn).toContain('kw-kw-classified');
    expect(fn).not.toContain('border:1.5px solid #7c3aed');
  });

  it('renderSubqueriesList がアクティブキーワードに kwPaletteActColor を参照する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderSubqueriesList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 5000);
    expect(fn).toContain('kwPaletteActColor');
  });
});
