import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('🔑ボタン全キーワードハイライト修正: 状態変数', () => {
  it('historyModalDBKeywordsApplied 変数が存在する', () => {
    expect(buildPage()).toContain('historyModalDBKeywordsApplied');
  });

  it('showHistoryModal で historyModalDBKeywordsApplied = false にリセットされる', () => {
    const html = buildPage();
    const idx = html.indexOf('function showHistoryModal');
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('historyModalDBKeywordsApplied = false');
  });
});

describe('🔑ボタン全キーワードハイライト修正: ヘルパー関数', () => {
  it('clearKeywordHighlights 関数が存在する', () => {
    expect(buildPage()).toContain('function clearKeywordHighlights(container)');
  });

  it('clearKeywordHighlights が kw-highlight マークを除去する', () => {
    const html = buildPage();
    const idx = html.indexOf('function clearKeywordHighlights(container)');
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('kw-highlight');
    expect(fn).toContain('replaceChild');
  });

  it('clearKeywordHighlights が normalize を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('function clearKeywordHighlights(container)');
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('normalize');
  });

  it('buildAllKeywords 関数が存在する', () => {
    expect(buildPage()).toContain('function buildAllKeywords()');
  });

  it('buildAllKeywords が historyModalCurrentKeyword を含む', () => {
    const html = buildPage();
    const idx = html.indexOf('function buildAllKeywords()');
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('historyModalCurrentKeyword');
  });

  it('buildAllKeywords が historyModalKeywordsFromDB を含む', () => {
    const html = buildPage();
    const idx = html.indexOf('function buildAllKeywords()');
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('historyModalKeywordsFromDB');
  });

  it('buildAllKeywords が重複を排除する（indexOf チェック）', () => {
    const html = buildPage();
    const idx = html.indexOf('function buildAllKeywords()');
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('indexOf');
  });
});

describe('🔑ボタン全キーワードハイライト修正: クリックハンドラ', () => {
  it('DB キーワードが未適用の場合に clearKeywordHighlights を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('historyModalHighlightToggleBtn.addEventListener');
    const fn = html.slice(idx, idx + 1000);
    expect(fn).toContain('clearKeywordHighlights');
  });

  it('DB キーワードが未適用の場合に buildAllKeywords を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('historyModalHighlightToggleBtn.addEventListener');
    const fn = html.slice(idx, idx + 1000);
    expect(fn).toContain('buildAllKeywords()');
  });

  it('DB キーワードが未適用の場合に historyModalDBKeywordsApplied を true にセットする', () => {
    const html = buildPage();
    const idx = html.indexOf('historyModalHighlightToggleBtn.addEventListener');
    const fn = html.slice(idx, idx + 1000);
    expect(fn).toContain('historyModalDBKeywordsApplied = true');
  });

  it('DB キーワード未適用パスで先に処理してから return する', () => {
    const html = buildPage();
    const idx = html.indexOf('historyModalHighlightToggleBtn.addEventListener');
    const fn = html.slice(idx, idx + 1000);
    const dbCheckIdx = fn.indexOf('historyModalDBKeywordsApplied');
    const returnIdx = fn.indexOf('return', dbCheckIdx);
    expect(dbCheckIdx).toBeGreaterThan(-1);
    expect(returnIdx).toBeGreaterThan(dbCheckIdx);
  });

  it('marks が空の場合は何もしない（早期 return）', () => {
    const html = buildPage();
    const idx = html.indexOf('historyModalHighlightToggleBtn.addEventListener');
    const fn = html.slice(idx, idx + 1000);
    expect(fn).toContain('marks.length === 0');
  });

  it('marks がある場合は historyModalHighlightActive を反転する', () => {
    const html = buildPage();
    const idx = html.indexOf('historyModalHighlightToggleBtn.addEventListener');
    const fn = html.slice(idx, idx + 1000);
    expect(fn).toContain('!historyModalHighlightActive');
  });
});

describe('🔑ボタン全キーワードハイライト修正: JS 構文チェック', () => {
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
