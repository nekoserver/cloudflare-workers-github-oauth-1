import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: {
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5',
  },
};

function buildPage(): string {
  return getAiChatPage(minimalUser);
}

describe('詳細プレビューモーダル: ハイライトトグルボタン — HTML要素', () => {
  it('historyModalHighlightToggleBtn が HTML に含まれる', () => {
    expect(buildPage()).toContain('historyModalHighlightToggleBtn');
  });

  it('highlights-hidden CSS クラスが定義されている', () => {
    expect(buildPage()).toContain('highlights-hidden');
  });

  it('kw-highlight の表示を消すスタイルが存在する', () => {
    const html = buildPage();
    const idx = html.indexOf('highlights-hidden');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 200);
    expect(snippet).toContain('kw-highlight');
  });
});

describe('詳細プレビューモーダル: ハイライトトグルボタン — 状態変数', () => {
  it('historyModalHighlightActive 変数が含まれる', () => {
    expect(buildPage()).toContain('historyModalHighlightActive');
  });

  it('historyModalCurrentKeyword 変数が含まれる', () => {
    expect(buildPage()).toContain('historyModalCurrentKeyword');
  });
});

describe('詳細プレビューモーダル: ハイライトトグルボタン — 関数', () => {
  it('updateHighlightToggleBtn 関数が含まれる', () => {
    expect(buildPage()).toContain('function updateHighlightToggleBtn');
  });

  it('updateHighlightToggleBtn が kw-highlight の存在チェックをする', () => {
    const html = buildPage();
    const idx = html.indexOf('function updateHighlightToggleBtn');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('kw-highlight');
  });

  it('updateHighlightToggleBtn が historyModalHighlightActive を参照する', () => {
    const html = buildPage();
    const idx = html.indexOf('function updateHighlightToggleBtn');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('historyModalHighlightActive');
  });

  it('ハイライトあり状態でボタンに「非表示」系テキストをセットする', () => {
    const html = buildPage();
    const idx = html.indexOf('function updateHighlightToggleBtn');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1200);
    expect(fn).toContain('非表示');
  });

  it('ハイライトなし状態でボタンに「表示」系テキストをセットする', () => {
    const html = buildPage();
    const idx = html.indexOf('function updateHighlightToggleBtn');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1200);
    expect(fn).toContain('表示');
  });
});

describe('詳細プレビューモーダル: ハイライトトグルボタン — クリック動作', () => {
  it('historyModalHighlightToggleBtn に click ハンドラが設定される', () => {
    const html = buildPage();
    expect(html).toContain('historyModalHighlightToggleBtn');
    const idx = html.indexOf('historyModalHighlightToggleBtn.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('click');
  });

  it('クリック時に historyModalHighlightActive を反転する', () => {
    const html = buildPage();
    const idx = html.indexOf('historyModalHighlightToggleBtn.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 800);
    expect(fn).toContain('historyModalHighlightActive');
    expect(fn).toContain('!historyModalHighlightActive');
  });

  it('クリック時に highlights-hidden クラスをトグルする', () => {
    const html = buildPage();
    const idx = html.indexOf('historyModalHighlightToggleBtn.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 800);
    expect(fn).toContain('highlights-hidden');
  });

  it('クリック時に updateHighlightToggleBtn を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('historyModalHighlightToggleBtn.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 800);
    expect(fn).toContain('updateHighlightToggleBtn');
  });
});

describe('詳細プレビューモーダル: ハイライトトグルボタン — showHistoryModal 連携', () => {
  it('showHistoryModal が historyModalHighlightActive をリセットする', () => {
    const html = buildPage();
    const idx = html.indexOf('function showHistoryModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2800);
    expect(fn).toContain('historyModalHighlightActive');
  });

  it('showHistoryModal が historyModalCurrentKeyword をセットする', () => {
    const html = buildPage();
    const idx = html.indexOf('function showHistoryModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2800);
    expect(fn).toContain('historyModalCurrentKeyword');
  });

  it('showHistoryModal が updateHighlightToggleBtn を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('function showHistoryModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2800);
    expect(fn).toContain('updateHighlightToggleBtn');
  });

  it('showHistoryModal が highlights-hidden クラスを除去する', () => {
    const html = buildPage();
    const idx = html.indexOf('function showHistoryModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2800);
    expect(fn).toContain('highlights-hidden');
  });
});
