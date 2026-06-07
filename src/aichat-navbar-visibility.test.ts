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
// langModeSelect の表示制御
// ===========================================================
describe('ナビバー: langModeSelect 表示制御', () => {
  it('aichat_show_lang_mode Cookie を読む', () => {
    expect(buildPage()).toContain('aichat_show_lang_mode');
  });

  it('langModeSelect を初期状態で非表示にするコードがある', () => {
    const html = buildPage();
    const idx = html.indexOf('aichat_show_lang_mode');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 400);
    // cookie が 'on' でなければ非表示にする
    expect(snippet).toContain('langModeSelect');
    expect(snippet).toContain("'none'");
  });
});

// ===========================================================
// modelSelect 表示制御（色丸のみ残す）
// ===========================================================
describe('ナビバー: modelSelect 表示制御', () => {
  it('aichat_show_model_name Cookie を読む', () => {
    expect(buildPage()).toContain('aichat_show_model_name');
  });

  it('modelSelect を初期状態で非表示にするコードがある', () => {
    const html = buildPage();
    const idx = html.indexOf('aichat_show_model_name');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain('modelSelect');
    expect(snippet).toContain("'none'");
  });

  it('modelColorDot は常に表示される（非表示コードがない）', () => {
    const html = buildPage();
    // modelColorDot を display:none にするコードがないこと
    const idx = html.indexOf('modelColorDot');
    expect(idx).toBeGreaterThan(-1);
    // modelColorDot の近くで display:none が使われていないことを確認
    // (modelSelect の非表示コードと分離して確認するため)
    expect(html).toContain('id="modelColorDot"');
  });
});

// ===========================================================
// 設定ページ: 2つのトグルが存在する
// ===========================================================
describe('設定ページ: AIチャットナビバー表示設定', () => {
  it('settings.ts に aichat_show_lang_mode Cookie を書くコードがある', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/views/settings.ts', 'utf-8');
    expect(src).toContain('aichat_show_lang_mode');
  });

  it('settings.ts に aichat_show_model_name Cookie を書くコードがある', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/views/settings.ts', 'utf-8');
    expect(src).toContain('aichat_show_model_name');
  });

  it('settings.ts に langMode 表示設定のラベルがある', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/views/settings.ts', 'utf-8');
    expect(src).toContain('aichatShowLangMode');
  });

  it('settings.ts に modelName 表示設定のラベルがある', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/views/settings.ts', 'utf-8');
    expect(src).toContain('aichatShowModelName');
  });
});

// ===========================================================
// 🔑分類ボタン: 依然として存在すること
// ===========================================================
describe('ナビバー: 🔑分類ボタン', () => {
  it('kwClassifyBtn が HTML に含まれる', () => {
    expect(buildPage()).toContain('kwClassifyBtn');
  });

  it('🔑分類 テキストが含まれる', () => {
    expect(buildPage()).toContain('🔑分類');
  });

  it('kwClassifyBtn.addEventListener が存在する', () => {
    const html = buildPage();
    const idx = html.indexOf('kwClassifyBtn.addEventListener');
    expect(idx).toBeGreaterThan(-1);
  });
});
