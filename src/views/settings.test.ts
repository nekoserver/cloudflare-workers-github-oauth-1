import { describe, it, expect } from 'vitest';
import { getSettingsPage } from './settings';

const minimalUser = {
  username: 'testuser',
  issuedAt: '2026-01-01T00:00:00Z',
  expiresAt: '2026-01-02T00:00:00Z',
  expiresAtTimestamp: 1234567890,
};

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
