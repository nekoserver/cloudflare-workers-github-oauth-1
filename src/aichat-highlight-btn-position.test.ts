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

describe('ハイライトトグルボタン: 位置と見た目', () => {
  it('historyModalHighlightToggleBtn が historyModalMeta より前に現れる', () => {
    const html = buildPage();
    const btnIdx = html.indexOf('historyModalHighlightToggleBtn');
    const metaIdx = html.indexOf('id="historyModalMeta"');
    expect(btnIdx).toBeGreaterThan(-1);
    expect(metaIdx).toBeGreaterThan(-1);
    expect(btnIdx).toBeLessThan(metaIdx);
  });

  it('ボタンの初期コンテンツは 🔑 のみ', () => {
    const html = buildPage();
    const idx = html.indexOf('historyModalHighlightToggleBtn');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 150);
    expect(snippet).toContain('🔑');
  });

  it('ボタンは初期状態で display:none ではない（常時表示）', () => {
    const html = buildPage();
    const idx = html.indexOf('id="historyModalHighlightToggleBtn"');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 200);
    expect(snippet).not.toContain('display:none');
  });
});

describe('ハイライトトグルボタン: updateHighlightToggleBtn — opacity による状態表現', () => {
  it('updateHighlightToggleBtn が opacity を設定する', () => {
    const html = buildPage();
    const idx = html.indexOf('function updateHighlightToggleBtn');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1200);
    expect(fn).toContain('opacity');
  });

  it('updateHighlightToggleBtn がテキストを変更しない（🔑アイコンのまま）', () => {
    const html = buildPage();
    const idx = html.indexOf('function updateHighlightToggleBtn');
    expect(idx).toBeGreaterThan(-1);
    // 関数本体のみを対象とするため次の function キーワードの手前で切る
    const raw = html.slice(idx, idx + 1200);
    const nextFn = raw.indexOf('function ', 10);
    const fn = nextFn > 0 ? raw.slice(0, nextFn) : raw;
    expect(fn).not.toContain('textContent');
  });

  it('アクティブ時に opacity が 1 になる', () => {
    const html = buildPage();
    const idx = html.indexOf('function updateHighlightToggleBtn');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1200);
    expect(fn).toContain("'1'");
  });

  it('非アクティブ時に opacity が 0.35 以下になる', () => {
    const html = buildPage();
    const idx = html.indexOf('function updateHighlightToggleBtn');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1200);
    expect(fn).toMatch(/0\.3[0-9]/);
  });

  it('ハイライトなし状態で opacity が 0.2 以下になる（無効状態）', () => {
    const html = buildPage();
    const idx = html.indexOf('function updateHighlightToggleBtn');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1200);
    expect(fn).toMatch(/0\.1[0-9]|0\.2[0-9]?/);
  });

  it('updateHighlightToggleBtn が display:none でボタンを隠さない', () => {
    const html = buildPage();
    const idx = html.indexOf('function updateHighlightToggleBtn');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1200);
    expect(fn).not.toContain("display = 'none'");
  });
});

describe('ハイライトトグルボタン: スワイプ後の highlights 再適用', () => {
  it('historyModalSwipeNavigate が historyModalCurrentKeyword を参照する', () => {
    const html = buildPage();
    const idx = html.indexOf('function historyModalSwipeNavigate');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2000);
    expect(fn).toContain('historyModalCurrentKeyword');
  });

  it('historyModalSwipeNavigate が applyKeywordHighlight を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('function historyModalSwipeNavigate');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2000);
    expect(fn).toContain('applyKeywordHighlight');
  });
});

describe('ハイライトトグルボタン: クリックハンドラ互換性', () => {
  it('click ハンドラで historyModalHighlightActive を反転する', () => {
    const html = buildPage();
    const idx = html.indexOf('historyModalHighlightToggleBtn.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1200);
    expect(fn).toContain('historyModalHighlightActive');
    expect(fn).toContain('!historyModalHighlightActive');
  });

  it('click ハンドラで highlights-hidden クラスをトグルする', () => {
    const html = buildPage();
    const idx = html.indexOf('historyModalHighlightToggleBtn.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 800);
    expect(fn).toContain('highlights-hidden');
  });
});
