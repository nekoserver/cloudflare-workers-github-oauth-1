import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// 対象: ログイン確認メール(EVP)ゲートのON/OFFユーザーオプション(デフォルトOFF)設定エンドポイント
// POST /api/settings/email-confirm-login (ログインユーザー本人が変更する、認証必須)
// および /settings ページがD1から現在値を読んでビューへ渡していること。
describe('ログイン確認メール(EVP)ゲート設定エンドポイント', () => {
  const src = readFileSync('src/index.ts', 'utf8');

  it('POSTは認証必須で登録されている', () => {
    expect(src).toContain("app.post('/api/settings/email-confirm-login', authMiddleware");
  });

  it('POSTはnotification_settings.email_confirm_login_enabledをUPSERTする', () => {
    const idx = src.indexOf("app.post('/api/settings/email-confirm-login'");
    const fn = src.slice(idx, src.indexOf('\n});', idx));
    expect(fn).toContain('INSERT INTO notification_settings');
    expect(fn).toContain('ON CONFLICT(id) DO UPDATE SET email_confirm_login_enabled = excluded.email_confirm_login_enabled');
  });

  it('/settings ルートはisEmailConfirmLoginEnabledでD1から現在値を読みビューへ渡す', () => {
    const idx = src.indexOf("app.get('/settings', authMiddleware");
    expect(idx).toBeGreaterThan(-1);
    const endIdx = src.indexOf("app.get('/auth-flow'", idx);
    const fn = src.slice(idx, endIdx);
    expect(fn).toContain('await isEmailConfirmLoginEnabled(c.env.DB)');
    expect(fn).toContain('emailConfirmLoginEnabled,');
  });
});
