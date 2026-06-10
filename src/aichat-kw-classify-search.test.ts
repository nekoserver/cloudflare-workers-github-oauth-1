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

describe('キーワード分類モーダル: 検索窓の設置', () => {
  it('kwClassifySearchInput がHTMLに含まれる', () => {
    expect(buildPage()).toContain('id="kwClassifySearchInput"');
  });

  it('検索窓が「キーワード分類」タイトルの直後（右側）に配置される', () => {
    const html = buildPage();
    const titleIdx = html.indexOf('🔑 キーワード分類');
    const inputIdx = html.indexOf('id="kwClassifySearchInput"');
    const bodyIdx = html.indexOf('id="kwClassifyListBody"');
    expect(titleIdx).toBeGreaterThan(-1);
    expect(inputIdx).toBeGreaterThan(titleIdx);
    expect(inputIdx).toBeLessThan(bodyIdx);
  });

  it('検索窓に placeholder が設定されている', () => {
    const html = buildPage();
    const idx = html.indexOf('id="kwClassifySearchInput"');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(Math.max(0, idx - 200), idx + 300);
    expect(snippet).toContain('placeholder');
  });
});

describe('キーワード分類モーダル: インクリメンタルサーチ', () => {
  it('applyKwClassifySearchFilter 関数が定義されている', () => {
    expect(buildPage()).toContain('function applyKwClassifySearchFilter');
  });

  it('フィルタが kw-classify-kw-badge を対象に data-keyword で部分一致する', () => {
    const html = buildPage();
    const idx = html.indexOf('function applyKwClassifySearchFilter');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 700);
    expect(fn).toContain('kw-classify-kw-badge');
    expect(fn).toContain('dataset.keyword');
    expect(fn).toContain('toLowerCase');
    expect(fn).toContain('indexOf');
  });

  it('input イベントで applyKwClassifySearchFilter が呼ばれる（インクリメンタル）', () => {
    const html = buildPage();
    const idx = html.indexOf("kwClassifySearchInput.addEventListener('input'");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 200);
    expect(fn).toContain('applyKwClassifySearchFilter');
  });

  it('一致しないバッジを display:none で非表示にする', () => {
    const html = buildPage();
    const idx = html.indexOf('function applyKwClassifySearchFilter');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 700);
    expect(fn).toContain("'none'");
  });
});

describe('キーワード分類モーダル: 検索状態のリセットと再適用', () => {
  it('openKwClassifyList が検索窓をクリアする', () => {
    const html = buildPage();
    const idx = html.indexOf('function openKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 700);
    expect(fn).toContain("kwClassifySearchInput.value = ''");
  });

  it('renderKwClassifyList が再描画後にフィルタを再適用する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    const endIdx = html.indexOf('function openKwCatGroupModal', idx);
    expect(endIdx).toBeGreaterThan(idx);
    const fn = html.slice(idx, endIdx);
    expect(fn).toContain('applyKwClassifySearchFilter()');
  });
});
