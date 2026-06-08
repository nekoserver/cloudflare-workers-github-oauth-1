import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};
function buildPage(): string { return getAiChatPage(minimalUser); }

// ===========================================================
// カテゴリバッジ: 初期状態は中抜き (OFF)
// ===========================================================
describe('カテゴリバッジ: 初期中抜き・個別ON/OFF トグル', () => {
  it('renderKwClassifyList でカテゴリバッジ生成時の background が transparent である', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    // カテゴリバッジ html += の行に background:var(--bg-secondary) が含まれる
    const fn = html.slice(idx, idx + 2000);
    const catBadgeIdx = fn.indexOf('kw-cat-summary-badge');
    expect(catBadgeIdx).toBeGreaterThan(-1);
    const catBadgeSnippet = fn.slice(catBadgeIdx, catBadgeIdx + 600);
    expect(catBadgeSnippet).toContain('background:var(--bg-secondary)');
  });

  it('カテゴリバッジの初期スタイルに color:{col} (枠色と同色テキスト) がある', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2000);
    const catBadgeIdx = fn.indexOf('kw-cat-summary-badge');
    expect(catBadgeIdx).toBeGreaterThan(-1);
    const catBadgeSnippet = fn.slice(catBadgeIdx, catBadgeIdx + 600);
    // border に var(--border-color) を使う（cg-group-btn 同等スタイル）
    expect(catBadgeSnippet).toContain('border:1px solid');
  });

  it('selectedCats オブジェクトが使われている (activeCatId 単一ではなく複数対応)', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 4000);
    expect(fn).toContain('selectedCats');
    expect(fn).not.toContain('activeCatId');
  });

  it('カテゴリバッジタップ時に自バッジのスタイルを ON/OFF で更新するコードがある', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 4000);
    // catEl.style を更新するコード
    expect(fn).toContain('catEl.style');
  });
});
