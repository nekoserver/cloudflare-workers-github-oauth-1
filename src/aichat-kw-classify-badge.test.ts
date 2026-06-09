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
    const idx = html.indexOf('class="kw-cat-summary-badge"');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain('border-radius:2px');
  });

  it('border が 1px solid var(--border-color) である', () => {
    const html = buildPage();
    const idx = html.indexOf('class="kw-cat-summary-badge"');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain('border:1px solid var(--border-color)');
  });

  it('font-size が 11px である', () => {
    const html = buildPage();
    const idx = html.indexOf('class="kw-cat-summary-badge"');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain('font-size:11px');
  });

  it('padding が 3px 11px である', () => {
    const html = buildPage();
    const idx = html.indexOf('class="kw-cat-summary-badge"');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain('padding:3px 11px');
  });

  it('margin が 1px である', () => {
    const html = buildPage();
    const idx = html.indexOf('class="kw-cat-summary-badge"');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain('margin:1px');
  });

  it('border-radius:10px は使われない', () => {
    const html = buildPage();
    const idx = html.indexOf('class="kw-cat-summary-badge"');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).not.toContain('border-radius:10px');
  });

  it('border:1.5px solid は使われない', () => {
    const html = buildPage();
    const idx = html.indexOf('class="kw-cat-summary-badge"');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).not.toContain('border:1.5px solid');
  });
});

// ===== カテゴリバッジ: 選択/解除に CSS クラス使用（白枠残り防止）=====
describe('キーワード分類モーダル: kw-cat-badge-active CSS クラスでトグル', () => {
  it('kw-cat-badge-active CSS クラスが定義されている', () => {
    const html = buildPage();
    expect(html).toContain('.kw-cat-badge-active');
  });

  it('kw-cat-badge-active が border-color:#3b82f6 を持つ', () => {
    const html = buildPage();
    const idx = html.indexOf('.kw-cat-badge-active');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 200);
    expect(snippet).toContain('#3b82f6');
  });

  it('カテゴリ選択時に classList.add(kw-cat-badge-active) する', () => {
    const html = buildPage();
    expect(html).toContain("classList.add('kw-cat-badge-active')");
  });

  it('カテゴリ解除時に classList.remove(kw-cat-badge-active) する', () => {
    const html = buildPage();
    expect(html).toContain("classList.remove('kw-cat-badge-active')");
  });

  it('catEl.style.borderColor を直接セットしない', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    const fn = html.slice(idx, idx + 4000);
    expect(fn).not.toContain("catEl.style.borderColor");
  });
});

// ===== キーワードバッジ: 分類済み=中抜き紫・余白1px =====
describe('キーワード分類モーダル: kw-classify-kw-badge のスタイル', () => {
  it('kw-kw-classified CSS クラスが定義されている', () => {
    const html = buildPage();
    expect(html).toContain('.kw-kw-classified');
  });

  it('kw-kw-classified が中抜き紫（border:1.5px solid #7c3aed, background:transparent）', () => {
    const html = buildPage();
    const idx = html.indexOf('.kw-kw-classified');
    const snippet = html.slice(idx, idx + 150);
    expect(snippet).toContain('#7c3aed');
    expect(snippet).toContain('transparent');
  });

  it('kw-classify-kw-badge の CSS margin が 1px である', () => {
    const html = buildPage();
    const idx = html.indexOf('.kw-classify-kw-badge');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 100);
    expect(snippet).toContain('margin:1px');
  });

  it('分類済みバッジが kw-kw-classified クラスを使う', () => {
    const html = buildPage();
    const idx = html.indexOf("var kwCls = 'kw-classify-kw-badge sq-kw-badge'");
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 200);
    expect(snippet).toContain('kw-kw-classified');
  });

  it('分類済みバッジが sq-kw-badge-active を使わない', () => {
    const html = buildPage();
    const idx = html.indexOf("var kwCls = 'kw-classify-kw-badge sq-kw-badge'");
    const snippet = html.slice(idx, idx + 200);
    expect(snippet).not.toContain('sq-kw-badge-active');
  });

  it('applyKwBadgeColors が el.className でクラスを切り替える', () => {
    const html = buildPage();
    const idx = html.indexOf('function applyKwBadgeColors');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 500);
    expect(snippet).toContain('el.className');
    expect(snippet).not.toContain('el.style.backgroundColor');
  });

  it('applyKwBadgeColors が kw-kw-classified を使う', () => {
    const html = buildPage();
    const idx = html.indexOf('function applyKwBadgeColors');
    const snippet = html.slice(idx, idx + 700);
    expect(snippet).toContain('kw-kw-classified');
  });

  it('applyKwBadgeColors が selectedCats[cid] で選択カテゴリを判定する', () => {
    const html = buildPage();
    const idx = html.indexOf('function applyKwBadgeColors');
    const snippet = html.slice(idx, idx + 500);
    expect(snippet).toContain('selectedCats[cid]');
  });

  it('applyKwBadgeColors が選択カテゴリ内キーワードに sq-kw-badge-active を適用する', () => {
    const html = buildPage();
    const idx = html.indexOf('function applyKwBadgeColors');
    const snippet = html.slice(idx, idx + 500);
    expect(snippet).toContain('sq-kw-badge-active');
  });

  it('applyKwBadgeColors が選択カテゴリの色で CSS 変数を設定する', () => {
    const html = buildPage();
    const idx = html.indexOf('function applyKwBadgeColors');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 600);
    expect(snippet).toContain('setProperty');
    expect(snippet).toContain('--kwcat-color');
    expect(snippet).toContain('--kwcat-bg');
  });
});

// ===== sq-kw-badge-active が CSS 変数でカテゴリ色を使う =====
describe('キーワード分類モーダル: 選択カテゴリ色でバッジを塗る', () => {
  it('sq-kw-badge-active CSS が --kwcat-color 変数を使う', () => {
    const html = buildPage();
    const idx = html.indexOf('.sq-kw-badge-active');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 200);
    expect(snippet).toContain('--kwcat-color');
  });

  it('sq-kw-badge-active CSS が --kwcat-bg 変数を使う', () => {
    const html = buildPage();
    const idx = html.indexOf('.sq-kw-badge-active');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 200);
    expect(snippet).toContain('--kwcat-bg');
  });
});

// ===== 縦余白: kwClassifyListBody の line-height:2 を除去 =====
describe('キーワード分類モーダル: キーワードバッジ縦余白', () => {
  it('kwClassifyListBody に line-height:2 がない', () => {
    const html = buildPage();
    const idx = html.indexOf('kwClassifyListBody');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 200);
    expect(snippet).not.toContain('line-height:2');
  });

  it('キーワードバッジが line-height:1 のラッパー div 内にある', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwClassifyList');
    const fn = html.slice(idx, idx + 5000);
    expect(fn).toContain('line-height:1');
  });
});
