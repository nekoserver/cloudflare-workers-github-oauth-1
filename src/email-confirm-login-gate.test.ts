import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// 対象: /auth/github/callback でのログイン確認メールゲート、および
// GET /auth/email-confirm (確認リンククリック後のログイン完了エンドポイント)。
// RESEND_API_KEY設定時のみ、JWT発行前にResend経由のメール確認(クリック待ち)を挟む。
describe('OAuthログインのメール確認ゲート', () => {
  const src = readFileSync('src/index.ts', 'utf8');

  it('/auth/github/callback はJWT発行前にshouldGateLoginOnEmailConfirmationで判定する', () => {
    const callbackIdx = src.indexOf("app.get('/auth/github/callback'");
    const confirmIdx = src.indexOf('shouldGateLoginOnEmailConfirmation(', callbackIdx);
    const finalizeIdx = src.indexOf('await finalizeGithubLogin(c, {', callbackIdx);
    expect(callbackIdx).toBeGreaterThan(-1);
    expect(confirmIdx).toBeGreaterThan(callbackIdx);
    expect(finalizeIdx).toBeGreaterThan(confirmIdx);
  });

  it('確認メール送信に失敗した場合は握りつぶさずエラーを返す', () => {
    const idx = src.indexOf('Failed to send login confirmation email');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 300);
    expect(snippet).toContain("502");
  });

  it('GET /auth/email-confirm が登録されている', () => {
    expect(src).toContain("app.get('/auth/email-confirm'");
  });

  it('/auth/email-confirm はトークンを一度きり消費し(consumePendingLogin)有効期限を検証する', () => {
    const idx = src.indexOf("app.get('/auth/email-confirm'");
    const endIdx = src.indexOf('\n});', idx);
    const fn = src.slice(idx, endIdx);
    expect(fn).toContain('consumePendingLogin(c.env.DB, confirmToken)');
    expect(fn).toContain('isPendingLoginExpired(record)');
    expect(fn).toContain('await finalizeGithubLogin(c, {');
  });

  it('finalizeGithubLoginはD1保存・JWT発行・Cookie組み立てを共通化する(重複実装を避ける)', () => {
    const idx = src.indexOf('async function finalizeGithubLogin');
    expect(idx).toBeGreaterThan(-1);
    const endIdx = src.indexOf('\n}', src.indexOf('buildAuthRedirectHeaders({', idx));
    const fn = src.slice(idx, endIdx);
    expect(fn).toContain('await updateUserSession(');
    expect(fn).toContain('await ensureDefaultWorkspace(');
    expect(fn).toContain('await createJWT(');
  });
});
