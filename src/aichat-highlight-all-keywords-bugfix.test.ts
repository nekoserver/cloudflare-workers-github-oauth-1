import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAiChatPage } from './views/aichat';

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};

function buildPage(): string {
  return getAiChatPage(minimalUser);
}

// ===========================================================
// 原因1: フェッチ未完了時に 🔑 を押すと何も起きないレース
// ===========================================================
describe('ハイライト全キーワード適用: クリック時のオンデマンド取得', () => {
  it('applyAllDbKeywordHighlights 関数が定義されている', () => {
    expect(buildPage()).toContain('function applyAllDbKeywordHighlights');
  });

  it('fetchShareKeywords 関数が share-keywords API を呼び keywords を保存する', () => {
    const html = buildPage();
    const idx = html.indexOf('function fetchShareKeywords');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 700);
    expect(fn).toContain('/api/aichat/share-keywords');
    expect(fn).toContain('historyModalKeywordsFromDB');
  });

  it('クリックハンドラ内で DB キーワード未取得時に fetchShareKeywords で再取得する', () => {
    const html = buildPage();
    const idx = html.indexOf('historyModalHighlightToggleBtn.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1200);
    expect(fn).toContain('fetchShareKeywords(');
  });

  it('クリックハンドラが applyAllDbKeywordHighlights を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('historyModalHighlightToggleBtn.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1200);
    expect(fn).toContain('applyAllDbKeywordHighlights');
  });
});

// ===========================================================
// 原因3: スワイプ後に DB キーワードが再適用されない
// ===========================================================
describe('ハイライト全キーワード適用: スワイプ後の再適用', () => {
  function sliceApplyData(html: string): string {
    const idx = html.indexOf('function applyData');
    expect(idx).toBeGreaterThan(-1);
    return html.slice(idx, idx + 2000);
  }

  it('applyData が historyModalDBKeywordsApplied をリセットする', () => {
    const fn = sliceApplyData(buildPage());
    expect(fn).toContain('historyModalDBKeywordsApplied = false');
  });

  it('applyData がスワイプ先 share のキーワードを fetchShareKeywords で再取得する', () => {
    const fn = sliceApplyData(buildPage());
    expect(fn).toContain('fetchShareKeywords(');
  });

  it('applyData が再取得後に buildAllKeywords または applyAllDbKeywordHighlights で再適用する', () => {
    const fn = sliceApplyData(buildPage());
    const reapplies =
      fn.includes('applyAllDbKeywordHighlights') || fn.includes('buildAllKeywords');
    expect(reapplies).toBe(true);
  });
});

// ===========================================================
// 原因2: API の LIMIT 10 でキーワードが欠落する
// ===========================================================
describe('ハイライト全キーワード適用: share-keywords API の取得上限', () => {
  it('share-keywords クエリの LIMIT が 10 より大きい', () => {
    const indexSrc = readFileSync(join(__dirname, 'index.ts'), 'utf-8');
    const apiIdx = indexSrc.indexOf("'/api/aichat/share-keywords'");
    expect(apiIdx).toBeGreaterThan(-1);
    const section = indexSrc.slice(apiIdx, apiIdx + 800);
    const m = section.match(/LIMIT\s+(\d+)/);
    expect(m).not.toBeNull();
    expect(parseInt(m![1], 10)).toBeGreaterThan(10);
  });
});
