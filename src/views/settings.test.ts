import { describe, it, expect } from 'vitest';
import { getSettingsPage } from './settings';

const minimalUser = {
  username: 'testuser',
  issuedAt: '2026-01-01T00:00:00Z',
  expiresAt: '2026-01-02T00:00:00Z',
  expiresAtTimestamp: 1234567890,
};

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
    expect(html).toContain('id="kwPanelNoAllFocusCheckbox"');
    const idx = html.indexOf('id="kwPanelNoAllFocusCheckbox"');
    const snippet = html.slice(Math.max(0, idx - 200), idx + 100);
    expect(snippet).not.toContain('checked');
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
