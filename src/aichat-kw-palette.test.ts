import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

// ===== 🎨ボタン =====
describe('カラーパレット: 🎨ボタン', () => {
  it('kwColorPaletteBtn が kwClassifyListModal ヘッダーに存在する', () => {
    const html = buildPage();
    const modalIdx = html.indexOf('id="kwClassifyListModal"');
    expect(modalIdx).toBeGreaterThan(-1);
    const header = html.slice(modalIdx, modalIdx + 1000);
    expect(header).toContain('kwColorPaletteBtn');
  });
});

// ===== kwColorPaletteModal HTML構造 =====
describe('カラーパレット: モーダルHTML', () => {
  it('kwColorPaletteModal が存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="kwColorPaletteModal"');
  });

  it('4つのカラーパレットセクションキーが含まれる (cat/cls/unc/act)', () => {
    const html = buildPage();
    const idx = html.indexOf('kwColorPaletteModal');
    const modal = html.slice(idx, idx + 20000);
    expect(modal).toContain('data-palette-key="cat"');
    expect(modal).toContain('data-palette-key="cls"');
    expect(modal).toContain('data-palette-key="unc"');
    expect(modal).toContain('data-palette-key="act"');
  });

  it('決定ボタン (kwColorPaletteConfirm) が存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="kwColorPaletteConfirm"');
  });

  it('カラースウォッチ (kw-color-swatch) が含まれる', () => {
    const html = buildPage();
    expect(html).toContain('kw-color-swatch');
  });

  it('kw-color-swatch CSS が定義されている', () => {
    const html = buildPage();
    expect(html).toContain('.kw-color-swatch');
  });
});

// ===== CSS変数 =====
describe('カラーパレット: CSS変数', () => {
  it('.kw-kw-classified が --kw-pal-cls 変数を使う', () => {
    const html = buildPage();
    const idx = html.indexOf('.kw-kw-classified');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 150);
    expect(snippet).toContain('--kw-pal-cls');
  });

  it('.kw-cat-badge-active が --kw-pal-cat 変数を使う', () => {
    const html = buildPage();
    const idx = html.indexOf('.kw-cat-badge-active');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 150);
    expect(snippet).toContain('--kw-pal-cat');
  });
});

// ===== JS関数 =====
describe('カラーパレット: JS関数', () => {
  it('applyKwPaletteToDom 関数が存在する', () => {
    const html = buildPage();
    expect(html).toContain('function applyKwPaletteToDom');
  });

  it('readKwPaletteFromCookies 関数が存在する', () => {
    const html = buildPage();
    expect(html).toContain('function readKwPaletteFromCookies');
  });

  it('saveKwPaletteToCookies 関数が存在する', () => {
    const html = buildPage();
    expect(html).toContain('function saveKwPaletteToCookies');
  });

  it('applyKwPaletteToDom が --kw-pal-cls を setProperty する', () => {
    const html = buildPage();
    const idx = html.indexOf('function applyKwPaletteToDom');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 800);
    expect(fn).toContain('--kw-pal-cls');
    expect(fn).toContain('--kw-pal-cat');
  });

  it('applyKwBadgeColors が kwPaletteActColor を参照する', () => {
    const html = buildPage();
    const idx = html.indexOf('function applyKwBadgeColors');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('kwPaletteActColor');
  });

  it('saveKwPaletteToCookies が kw_pal_ プレフィックスの Cookie を保存する', () => {
    const html = buildPage();
    const idx = html.indexOf('function saveKwPaletteToCookies');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('kw_pal_');
    expect(fn).toContain('document.cookie');
  });

  it('readKwPaletteFromCookies が kw_pal_ プレフィックスの Cookie を読む', () => {
    const html = buildPage();
    const idx = html.indexOf('function readKwPaletteFromCookies');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('kw_pal_');
  });
});

// ===== staticZDefaults への登録 =====
describe('カラーパレット: staticZDefaults 登録', () => {
  it('staticZDefaults に kwColorPaletteModal が含まれる', () => {
    const html = buildPage();
    const idx = html.indexOf('staticZDefaults');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 500);
    expect(snippet).toContain('kwColorPaletteModal');
  });
});
