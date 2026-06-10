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
// バグ: all-keywords の LEFT JOIN ファンアウトで select_count が
// マッピング数倍に膨張し、リスト上の位置が移動して消えたように見える
// ===========================================================
describe('all-keywords API: JOINファンアウトによる件数膨張の防止', () => {
  function sliceAllKeywords(): string {
    const indexSrc = readFileSync(join(__dirname, 'index.ts'), 'utf-8');
    const apiIdx = indexSrc.indexOf("'/api/aichat/all-keywords'");
    expect(apiIdx).toBeGreaterThan(-1);
    return indexSrc.slice(apiIdx, apiIdx + 2200);
  }

  it('select_count の集計を JOIN 前のサブクエリで行う', () => {
    const section = sliceAllKeywords();
    expect(section).toMatch(/FROM \(SELECT[\s\S]*?SUM\(select_count\)[\s\S]*?GROUP BY keyword\) s/);
  });

  it('JOIN 後の行数に依存する SUM(s.select_count) を使わない', () => {
    const section = sliceAllKeywords();
    expect(section).not.toContain('SUM(s.select_count)');
  });

  it('複数カテゴリを category_pairs (id:color のカンマ連結) で返す', () => {
    const section = sliceAllKeywords();
    expect(section).toContain('category_pairs');
    expect(section).toContain('GROUP_CONCAT');
  });
});

// ===========================================================
// バグ: GROUP BY で category_id が1つに潰され、2つ目以降の
// カテゴリの ON/OFF トグルでハイライトされない
// ===========================================================
describe('キーワード分類モーダル: 複数カテゴリのハイライト対応', () => {
  it('バッジに data-cat-ids (全カテゴリID) が付与される', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    const endIdx = html.indexOf('function openKwCatGroupModal', idx);
    const fn = html.slice(idx, endIdx);
    expect(fn).toContain('data-cat-ids');
  });

  it('バッジに data-cat-colors (ID→色マップ) が付与される', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    const endIdx = html.indexOf('function openKwCatGroupModal', idx);
    const fn = html.slice(idx, endIdx);
    expect(fn).toContain('data-cat-colors');
  });

  it('renderKwClassifyList が category_pairs をパースする', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    const endIdx = html.indexOf('function openKwCatGroupModal', idx);
    const fn = html.slice(idx, endIdx);
    expect(fn).toContain('category_pairs');
  });

  it('applyKwBadgeColors が dataset.catIds の全IDを selectedCats と照合する', () => {
    const html = buildPage();
    const idx = html.indexOf('function applyKwBadgeColors');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1500);
    expect(fn).toContain('dataset.catIds');
    expect(fn).toContain('selectedCats[String(');
  });

  it('applyKwBadgeColors が一致カテゴリの色を catColors マップから取得する', () => {
    const html = buildPage();
    const idx = html.indexOf('function applyKwBadgeColors');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1500);
    expect(fn).toContain('dataset.catColors');
  });

  it('applyKwBadgeColors が catIds 不在時に従来の data-cat-id へフォールバックする', () => {
    const html = buildPage();
    const idx = html.indexOf('function applyKwBadgeColors');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1500);
    expect(fn).toContain('dataset.catId');
  });
});
