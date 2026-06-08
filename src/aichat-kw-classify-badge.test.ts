import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

// ===== カテゴリバッジ (cg-group-btn 同等スタイル) =====
describe('キーワード分類モーダル: kw-cat-summary-badge のスタイル（cg-group-btn 準拠）', () => {
  it('border-radius が 2px である（丸なし）', () => {
    const html = buildPage();
    const idx = html.indexOf('kw-cat-summary-badge');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain('border-radius:2px');
  });

  it('border が 1px solid var(--border-color) である', () => {
    const html = buildPage();
    const idx = html.indexOf('kw-cat-summary-badge');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain('border:1px solid var(--border-color)');
  });

  it('font-size が 11px である', () => {
    const html = buildPage();
    const idx = html.indexOf('kw-cat-summary-badge');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain('font-size:11px');
  });

  it('padding が 3px 11px である', () => {
    const html = buildPage();
    const idx = html.indexOf('kw-cat-summary-badge');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain('padding:3px 11px');
  });

  it('border-radius:10px は使われない', () => {
    const html = buildPage();
    const idx = html.indexOf('kw-cat-summary-badge');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).not.toContain('border-radius:10px');
  });

  it('border:1.5px solid は使われない', () => {
    const html = buildPage();
    const idx = html.indexOf('kw-cat-summary-badge');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).not.toContain('border:1.5px solid');
  });
});

// ===== キーワードバッジ (sq-kw-badge CSS クラス使用) =====
describe('キーワード分類モーダル: kw-classify-kw-badge が sq-kw-badge クラスを使う', () => {
  it("分類済みバッジが sq-kw-badge-active クラス名を持つ", () => {
    const html = buildPage();
    const idx = html.indexOf("'kw-classify-kw-badge sq-kw-badge'");
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 200);
    expect(snippet).toContain('sq-kw-badge-active');
  });

  it("kw-classify-kw-badge が sq-kw-badge クラスを含む", () => {
    const html = buildPage();
    const idx = html.indexOf("'kw-classify-kw-badge sq-kw-badge'");
    expect(idx).toBeGreaterThan(-1);
  });

  it('インライン style で padding:0 6px を使わない', () => {
    const html = buildPage();
    const idx = html.indexOf("'kw-classify-kw-badge sq-kw-badge'");
    const snippet = html.slice(idx, idx + 300);
    expect(snippet).not.toContain('padding:0 6px');
    expect(snippet).not.toContain('padding:1px 6px');
  });

  it('applyKwBadgeColors が el.className でクラスを切り替える', () => {
    const html = buildPage();
    const idx = html.indexOf('function applyKwBadgeColors');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 300);
    expect(snippet).toContain('el.className');
    expect(snippet).not.toContain('el.style.backgroundColor');
  });
});

// ===== カテゴリ選択時の青ハイライト =====
describe('キーワード分類モーダル: カテゴリ選択時の青ハイライト', () => {
  it("選択時に #3b82f6 (青) の borderColor をセットする", () => {
    const html = buildPage();
    expect(html).toContain("catEl.style.borderColor = '#3b82f6'");
  });

  it("選択時に #dbeafe の background をセットする", () => {
    const html = buildPage();
    expect(html).toContain("catEl.style.background = '#dbeafe'");
  });
});
