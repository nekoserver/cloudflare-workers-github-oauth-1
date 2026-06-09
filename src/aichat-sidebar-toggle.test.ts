import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('サイドバートグル: 開く時の初期化処理', () => {
  it('sidebarToggle の click ハンドラが存在する', () => {
    const html = buildPage();
    expect(html).toContain("sidebarToggle.addEventListener('click'");
  });

  it('トグルハンドラ内でキーワードの有無をチェックする', () => {
    const html = buildPage();
    const idx = html.indexOf("sidebarToggle.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1200);
    expect(fn).toContain('sidebarSearch.value');
  });

  it('キーワードありの場合に doSearch を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf("sidebarToggle.addEventListener('click'");
    const fn = html.slice(idx, idx + 1200);
    expect(fn).toContain('doSearch');
  });

  it('キーワードありの場合に sidebarResults.innerHTML を空にする', () => {
    const html = buildPage();
    const idx = html.indexOf("sidebarToggle.addEventListener('click'");
    const fn = html.slice(idx, idx + 1200);
    expect(fn).toContain('sidebarResults.innerHTML');
  });

  it('キーワードありの場合に currentResults を空配列にリセットする', () => {
    const html = buildPage();
    const idx = html.indexOf("sidebarToggle.addEventListener('click'");
    const fn = html.slice(idx, idx + 1200);
    expect(fn).toContain('currentResults = []');
  });

  it('キーワードなしの場合に doDateLoad を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf("sidebarToggle.addEventListener('click'");
    const fn = html.slice(idx, idx + 1200);
    expect(fn).toContain('doDateLoad');
  });

  it('キーワードなしの場合に loadCalendar を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf("sidebarToggle.addEventListener('click'");
    const fn = html.slice(idx, idx + 1200);
    expect(fn).toContain('loadCalendar');
  });
});

describe('サイドバートグル: 閉じる時のクリア処理', () => {
  it('closeSidebar 内で sidebarResults.innerHTML を空にする', () => {
    const html = buildPage();
    const idx = html.indexOf('function closeSidebar');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('sidebarResults.innerHTML');
  });

  it('closeSidebar 内で currentResults を空配列にリセットする', () => {
    const html = buildPage();
    const idx = html.indexOf('function closeSidebar');
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('currentResults = []');
  });

  it('closeSidebar 内で searchLogRecordBtn を非表示にする', () => {
    const html = buildPage();
    const idx = html.indexOf('function closeSidebar');
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('searchLogRecordBtn');
  });

  it('closeSidebar 内で currentMode を search にリセットする', () => {
    const html = buildPage();
    const idx = html.indexOf('function closeSidebar');
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain("currentMode = 'search'");
  });
});
