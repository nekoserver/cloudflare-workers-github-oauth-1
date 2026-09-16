import { describe, expect, it } from 'vitest';
import { getSettingsPage } from './settings';

const html = getSettingsPage({
  username: 'octocat',
  issuedAt: '2026-09-16 10:00',
  expiresAt: '2026-09-16 11:00',
  expiresAtTimestamp: 1_789_553_600,
});

describe('設定ページのジャンプメニュー', () => {
  it('設定を機能別に分類した左サイドナビゲーションを表示する', () => {
    expect(html).toContain('<aside class="settings-sidebar"');
    expect(html).toContain('aria-label="設定ページ内メニュー"');
    expect(html).toContain('<span class="jump-menu-group-title">アカウント</span>');
    expect(html).toContain('<span class="jump-menu-group-title">ページ・機能別</span>');
  });

  it.each([
    ['ログインとセキュリティ', 'account'],
    ['基本表示', 'appearance'],
    ['キャッシュ状況', 'status-settings'],
    ['ER図', 'er-diagram-settings'],
    ['検索・AIチャット', 'search-ai-settings'],
    ['データ・ツール', 'data-tools-settings'],
    ['APIリファレンス', 'api-settings'],
    ['承認の取り消し', 'danger-zone'],
  ])('%sへのリンクとジャンプ先が対応する', (label, id) => {
    expect(html).toContain(`href="#${id}"`);
    expect(html).toMatch(new RegExp(`id="${id}"`));
    expect(html).toContain(label);
  });

  it('狭い画面ではジャンプメニューを横スクロールできる', () => {
    expect(html).toMatch(/@media \(max-width: 820px\)[\s\S]*\.jump-menu-list[\s\S]*overflow-x: auto/);
  });
});
