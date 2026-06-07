import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('モーダル検索→サイドバー連携: doHistoryModalSearch', () => {
  it('doHistoryModalSearch 関数が存在する', () => {
    expect(buildPage()).toContain('function doHistoryModalSearch()');
  });

  it('キーワードをサイドバー検索窓にコピーする', () => {
    const html = buildPage();
    const idx = html.indexOf('function doHistoryModalSearch()');
    const snippet = html.slice(idx, idx + 600);
    expect(snippet).toContain('sidebarSearch.value = kw');
  });

  it('doSearch(kw) を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('function doHistoryModalSearch()');
    const snippet = html.slice(idx, idx + 900);
    expect(snippet).toContain('doSearch(kw)');
  });

  it('doSearch 前に sidebarResults.innerHTML を空にする', () => {
    const html = buildPage();
    const idx = html.indexOf('function doHistoryModalSearch()');
    const snippet = html.slice(idx, idx + 900);
    const clearIdx = snippet.indexOf("sidebarResults.innerHTML = ''");
    const searchIdx = snippet.indexOf('doSearch(kw)');
    expect(clearIdx).toBeGreaterThan(-1);
    expect(clearIdx).toBeLessThan(searchIdx);
  });

  it('doSearch 前に currentResults を空配列にリセットする', () => {
    const html = buildPage();
    const idx = html.indexOf('function doHistoryModalSearch()');
    const snippet = html.slice(idx, idx + 900);
    const resetIdx = snippet.indexOf('currentResults = []');
    const searchIdx = snippet.indexOf('doSearch(kw)');
    expect(resetIdx).toBeGreaterThan(-1);
    expect(resetIdx).toBeLessThan(searchIdx);
  });

  it('doSearch 前に「検索中...」ステータスを表示する', () => {
    const html = buildPage();
    const idx = html.indexOf('function doHistoryModalSearch()');
    const snippet = html.slice(idx, idx + 900);
    const statusIdx = snippet.indexOf("sidebarStatus.textContent = '検索中...'");
    const searchIdx = snippet.indexOf('doSearch(kw)');
    expect(statusIdx).toBeGreaterThan(-1);
    expect(statusIdx).toBeLessThan(searchIdx);
  });

  it('currentMode を search にセットする', () => {
    const html = buildPage();
    const idx = html.indexOf('function doHistoryModalSearch()');
    const snippet = html.slice(idx, idx + 900);
    expect(snippet).toContain("currentMode = 'search'");
  });
});

describe('モーダル検索→サイドバー連携: JS 構文チェック', () => {
  it('script タグ内の JS に構文エラーがない', () => {
    const html = buildPage();
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = scriptRe.exec(html)) !== null) {
      const js = m[1];
      expect(() => {
        new Function(`(function(){\n${js}\n})`);
      }).not.toThrow();
    }
  });
});
