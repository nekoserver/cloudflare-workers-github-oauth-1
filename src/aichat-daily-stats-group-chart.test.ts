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

function sliceBuildFn(html: string): string {
  const idx = html.indexOf('function buildKwClassifyStatsHtml');
  expect(idx).toBeGreaterThan(-1);
  return html.slice(idx, idx + 6000);
}

function sliceRenderFn(html: string): string {
  const idx = html.indexOf('function renderDailyStatsChart');
  expect(idx).toBeGreaterThan(-1);
  return html.slice(idx, idx + 20000);
}

describe('日次統計モーダル: 大分類グループ別棒グラフ', () => {
  it('renderDailyStatsChart が category-groups API を取得する', () => {
    const fn = sliceRenderFn(buildPage());
    expect(fn).toContain('/api/aichat/category-groups');
  });

  it('buildKwClassifyStatsHtml に groups パラメータが渡される', () => {
    const fn = sliceRenderFn(buildPage());
    expect(fn).toMatch(/buildKwClassifyStatsHtml\(kwAll,\s*catSummary,\s*\w+\)/);
  });

  it('buildKwClassifyStatsHtml はグループが存在するときグループ単位で棒グラフを描画する', () => {
    const fn = sliceBuildFn(buildPage());
    expect(fn).toContain('group_name');
  });

  it('グループ存在時は大分類別キーワード数ラベルを使う', () => {
    const fn = sliceBuildFn(buildPage());
    expect(fn).toContain('大分類別キーワード数');
  });

  it('グループがない場合は分類カテゴリ別キーワード数フォールバック', () => {
    const fn = sliceBuildFn(buildPage());
    expect(fn).toContain('分類カテゴリ別キーワード数');
  });
});
