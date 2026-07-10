import { describe, it, expect } from 'vitest';
import { getSettingsPage } from './settings';

const baseUser = {
  username: 'octocat',
  issuedAt: '2026-01-01 00:00',
  expiresAt: '2026-01-01 01:00',
  expiresAtTimestamp: 1234567890,
};

// 対象: 設定ページの「ログイン確認メール(EVP)を必須にする」トグル。
// デフォルトOFFであること、ONにするとロックアウトのリスクがある旨の説明を
// 表示することを確認する。
describe('設定ページ: ログイン確認メール(EVP)ゲートのユーザーオプション', () => {
  it('emailConfirmLoginEnabled を指定しない場合はデフォルトでOFF(未チェック)表示になる', () => {
    const html = getSettingsPage({ ...baseUser });
    expect(html).toContain('id="emailConfirmLoginCheckbox"');
    expect(html).not.toMatch(/id="emailConfirmLoginCheckbox"\s+checked/);
    expect(html).toContain('id="emailConfirmLoginLabel">OFF<');
  });

  it('emailConfirmLoginEnabled=false でも明示的にOFF表示になる', () => {
    const html = getSettingsPage({ ...baseUser, emailConfirmLoginEnabled: false });
    expect(html).not.toMatch(/id="emailConfirmLoginCheckbox"\s+checked/);
    expect(html).toContain('id="emailConfirmLoginLabel">OFF<');
  });

  it('emailConfirmLoginEnabled=true の場合はON(チェック済み)表示になる', () => {
    const html = getSettingsPage({ ...baseUser, emailConfirmLoginEnabled: true });
    expect(html).toMatch(/id="emailConfirmLoginCheckbox"[\s\S]{0,80}checked/);
    expect(html).toContain('id="emailConfirmLoginLabel">ON<');
  });

  it('ONにするとロックアウトのリスクがある旨の説明を表示する', () => {
    const html = getSettingsPage({ ...baseUser });
    expect(html).toContain('デフォルトOFF');
    expect(html).toContain('ログインできなくなる');
  });

  it('変更はonEmailConfirmLoginChangeで/api/settings/email-confirm-loginへPOSTする', () => {
    const html = getSettingsPage({ ...baseUser });
    expect(html).toContain('onchange="onEmailConfirmLoginChange()"');
    const fnIdx = html.indexOf('async function onEmailConfirmLoginChange');
    expect(fnIdx).toBeGreaterThan(-1);
    const fn = html.slice(fnIdx, html.indexOf('\n    }', fnIdx));
    expect(fn).toContain("fetch('/api/settings/email-confirm-login'");
    expect(fn).toContain('method: \'POST\'');
  });
});
