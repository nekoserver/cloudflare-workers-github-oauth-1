import { describe, it, expect } from 'vitest';
import { getSettingsPage } from './settings';

const minimalUser = {
  username: 'testuser',
  issuedAt: '2026-01-01T00:00:00Z',
  expiresAt: '2026-01-02T00:00:00Z',
  expiresAtTimestamp: 1234567890,
};

describe('設定ページ: カテゴリグループOFF時に全バッジをOFFにする設定', () => {
  it('cgGroupOffClearsBadgesCheckbox が存在する', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('id="cgGroupOffClearsBadgesCheckbox"');
  });

  it('cg_group_off_clears_badges Cookie を参照する', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('cg_group_off_clears_badges');
  });

  it('onCgGroupOffClearsBadgesChange 関数が存在する', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('function onCgGroupOffClearsBadgesChange()');
  });

  it('設定項目の説明ラベルが存在する', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('カテゴリグループのトグルスイッチがOFFになったら');
  });

  it('デフォルトは ON (checked)', () => {
    const html = getSettingsPage(minimalUser);
    const idx = html.indexOf('id="cgGroupOffClearsBadgesCheckbox"');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 200);
    expect(snippet).toContain('checked');
  });
});

describe('設定ページ: キーワード詳細パネル外タップでパネルを閉じる設定', () => {
  it('kwPanelTapCloseCheckbox が存在する', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('id="kwPanelTapCloseCheckbox"');
  });

  it('kw_panel_tap_close Cookie を参照する', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('kw_panel_tap_close');
  });

  it('onKwPanelTapCloseChange 関数が存在する', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('function onKwPanelTapCloseChange()');
  });

  it('設定項目の説明ラベルが存在する', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('パネル領域以外をタップしてもパネルを閉じられるようにする');
  });

  it('デフォルトは ON (checked)', () => {
    const html = getSettingsPage(minimalUser);
    const idx = html.indexOf('id="kwPanelTapCloseCheckbox"');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 200);
    expect(snippet).toContain('checked');
  });
});

describe('設定ページ: キーワード詳細パネル閉時のすべてフォーカス抑制設定', () => {
  it('kwPanelNoAllFocusCheckbox が存在する', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('id="kwPanelNoAllFocusCheckbox"');
  });

  it('kw_panel_no_all_focus Cookie を参照する', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('kw_panel_no_all_focus');
  });

  it('onKwPanelNoAllFocusChange 関数が存在する', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('function onKwPanelNoAllFocusChange()');
  });

  it('設定項目の説明ラベルが存在する', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('すべて』にフォーカスが当たらないようにする');
  });

  it('デフォルトは OFF (unchecked)', () => {
    const html = getSettingsPage(minimalUser);
    const idx = html.indexOf('id="kwPanelNoAllFocusCheckbox"');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(Math.max(0, idx - 200), idx + 100);
    expect(snippet).not.toContain('checked');
  });
});

describe('設定ページ: AIチャット過去ログプレビューモード設定', () => {
  it('aichatHistoryPreviewModeSelect が存在する', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('id="aichatHistoryPreviewModeSelect"');
  });

  it('aichatHistoryPreviewModeButtonContainer が存在する', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('id="aichatHistoryPreviewModeButtonContainer"');
  });

  it('saveAichatHistoryPreviewMode 関数が存在する', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('function saveAichatHistoryPreviewMode()');
  });

  it('cancelAichatHistoryPreviewMode 関数が存在する', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('function cancelAichatHistoryPreviewMode()');
  });

  it('onAichatHistoryPreviewModeChange でボタンコンテナを show/hide する', () => {
    const html = getSettingsPage(minimalUser);
    const idx = html.indexOf('function onAichatHistoryPreviewModeChange()');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 400);
    expect(fnBody).toContain('aichatHistoryPreviewModeButtonContainer');
    expect(fnBody).toContain('show');
  });

  it('Cookie 保存時に Secure フラグを含まない（HTTP環境でも動作）', () => {
    const html = getSettingsPage(minimalUser);
    const idx = html.indexOf('function saveAichatHistoryPreviewMode()');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 500);
    expect(fnBody).toContain('aichat_history_preview_mode');
    expect(fnBody).not.toContain('; Secure');
  });

  it('showSettingsToast 関数が存在する', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('function showSettingsToast(');
  });

  it('settingsToast 要素が HTML に含まれる', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('id="settingsToast"');
  });

  it('settings-toast CSS が存在する', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('.settings-toast');
  });

  it('aichat_sidebar_tap_close 初期化の正規表現が正しい（4スラッシュバグなし）', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).not.toContain('\\\\s*aichat_sidebar_tap_close');
  });
});

describe('設定ページ: 検索履歴インクリメントサーチ設定', () => {
  it('historyIncrSearchCheckbox が存在する', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('id="historyIncrSearchCheckbox"');
  });

  it('history_incr_search Cookie を参照する', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('history_incr_search');
  });

  it('onHistoryIncrSearchChange 関数が存在する', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('function onHistoryIncrSearchChange()');
  });

  it('インクリメントサーチの説明ラベルが存在する', () => {
    const html = getSettingsPage(minimalUser);
    expect(html).toContain('インクリメントサーチ');
  });
});
