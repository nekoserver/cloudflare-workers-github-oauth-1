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

describe('日次統計モーダル: 分類状況セクションのデータ取得', () => {
  it('renderDailyStatsChart が all-keywords API を取得する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2500);
    expect(fn).toContain('/api/aichat/all-keywords');
  });

  it('renderDailyStatsChart が keyword-categories-summary API を取得する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2500);
    expect(fn).toContain('/api/aichat/keyword-categories-summary');
  });

  it('左パネルに buildKwClassifyStatsHtml の結果が追加される', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderDailyStatsChart');
    expect(idx).toBeGreaterThan(-1);
    const endIdx = html.indexOf("document.getElementById('dailyStatsPrev')", idx);
    const fn = html.slice(idx, endIdx);
    expect(fn).toContain('leftHtml += buildKwClassifyStatsHtml(');
  });
});

describe('日次統計モーダル: 分類済み・未分類の総数表示と円グラフ', () => {
  it('buildKwClassifyStatsHtml 関数が定義されている', () => {
    expect(buildPage()).toContain('function buildKwClassifyStatsHtml');
  });

  it('「分類済みキーワード総数 :」ラベルを出力する', () => {
    const fn = sliceBuildFn(buildPage());
    expect(fn).toContain('分類済みキーワード総数 : ');
  });

  it('「未分類キーワード総数 :」ラベルを出力する', () => {
    const fn = sliceBuildFn(buildPage());
    expect(fn).toContain('未分類キーワード総数 : ');
  });

  it('is_classified で分類済み・未分類をカウントする', () => {
    const fn = sliceBuildFn(buildPage());
    expect(fn).toContain('is_classified');
  });

  it('分類済み+未分類を母数とした円グラフ SVG を出力する', () => {
    const fn = sliceBuildFn(buildPage());
    expect(fn).toContain('<svg');
    expect(fn).toContain('Math.PI');
  });

  it('片方が0件のとき全円を circle 要素で描画する', () => {
    const fn = sliceBuildFn(buildPage());
    expect(fn).toContain('<circle');
  });

  it('総数0件のとき空文字を返す', () => {
    const fn = sliceBuildFn(buildPage());
    expect(fn).toMatch(/if \(total === 0\) return '';/);
  });
});

describe('日次統計モーダル: 分類カテゴリ別棒グラフ', () => {
  it('カテゴリを kw_count 降順でソートする', () => {
    const fn = sliceBuildFn(buildPage());
    expect(fn).toContain('kw_count');
    expect(fn).toMatch(/sort\(function\s*\(a, b\)/);
  });

  it('カテゴリ名の右側に width % の横棒を描画する', () => {
    const fn = sliceBuildFn(buildPage());
    expect(fn).toContain('width:');
    expect(fn).toContain("+ pct + '%");
  });

  it('棒の色にカテゴリの color を使う', () => {
    const fn = sliceBuildFn(buildPage());
    expect(fn).toMatch(/escHtml\(\w+\.color/);
  });
});
