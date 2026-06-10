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

// ===========================================================
// バグ: subqueriesKwCatMap が1キーワード=1カテゴリIDしか持たず、
// 2つ目以降に追加された分類カテゴリを選択しても
// 「選択中の分類に該当するサブクエリがありません」になる
// ===========================================================
describe('サブクエリ一覧: キーワード→カテゴリマップの複数カテゴリ対応', () => {
  function sliceOpenSubqueries(html: string): string {
    const idx = html.indexOf('function openSubqueries');
    expect(idx).toBeGreaterThan(-1);
    return html.slice(idx, idx + 3000);
  }

  it('openSubqueries が category_pairs をパースして全カテゴリIDを保持する', () => {
    const fn = sliceOpenSubqueries(buildPage());
    expect(fn).toContain('category_pairs');
  });

  it('subqueriesKwCatMap に配列でカテゴリIDを格納する', () => {
    const fn = sliceOpenSubqueries(buildPage());
    expect(fn).toMatch(/subqueriesKwCatMap\[kw\.keyword\] = ids/);
  });

  it('category_pairs 欠落時は category_id 単体へフォールバックする', () => {
    const fn = sliceOpenSubqueries(buildPage());
    expect(fn).toContain('kw.category_id != null');
  });
});

describe('サブクエリ一覧: 分類フィルタが全カテゴリIDを照合する', () => {
  function sliceRender(html: string): string {
    const idx = html.indexOf('function renderSubqueriesList');
    expect(idx).toBeGreaterThan(-1);
    return html.slice(idx, idx + 6000);
  }

  it('フィルタが some で複数カテゴリIDを sqSelectedCats と照合する', () => {
    const fn = sliceRender(buildPage());
    expect(fn).toMatch(/cids\.some\(function\s*\(/);
    expect(fn).toContain('sqSelectedCats[String(');
  });

  it('キーワードバッジのアクティブ判定も全カテゴリIDを走査する', () => {
    const fn = sliceRender(buildPage());
    expect(fn).toContain('activeCid');
  });

  it('アクティブ色は一致したカテゴリIDの色を使う', () => {
    const fn = sliceRender(buildPage());
    expect(fn).toContain('sqCatColorMap[activeCid]');
  });
});
