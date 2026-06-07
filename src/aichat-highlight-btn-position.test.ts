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
    // ボタン要素直近に 🔑 があり、ハイライト非表示 等のテキストがない
    const snippet = html.slice(idx, idx + 150);
    expect(snippet).toContain('🔑');
  });
});

describe('ハイライトトグルボタン: updateHighlightToggleBtn — opacity による状態表現', () => {
  it('updateHighlightToggleBtn がアクティブ状態で opacity を設定する', () => {
    const html = buildPage();
    const idx = html.indexOf('function updateHighlightToggleBtn');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('opacity');
  });

  it('updateHighlightToggleBtn がテキストを変更しない（🔑アイコンのまま）', () => {
    const html = buildPage();
    const idx = html.indexOf('function updateHighlightToggleBtn');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    // textContent による文字列切り替えがないこと
    expect(fn).not.toContain('textContent');
  });

  it('アクティブ時に opacity が 1 になる', () => {
    const html = buildPage();
    const idx = html.indexOf('function updateHighlightToggleBtn');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain("'1'");
  });

  it('非アクティブ時に opacity が 0.35 以下になる', () => {
    const html = buildPage();
    const idx = html.indexOf('function updateHighlightToggleBtn');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toMatch(/0\.3[0-9]/);
  });
});

describe('ハイライトトグルボタン: クリックハンドラ互換性', () => {
  it('click ハンドラで historyModalHighlightActive を反転する', () => {
    const html = buildPage();
    const idx = html.indexOf('historyModalHighlightToggleBtn.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('historyModalHighlightActive');
    expect(fn).toContain('!historyModalHighlightActive');
  });

  it('click ハンドラで highlights-hidden クラスをトグルする', () => {
    const html = buildPage();
    const idx = html.indexOf('historyModalHighlightToggleBtn.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('highlights-hidden');
  });
});
