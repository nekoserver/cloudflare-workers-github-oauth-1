import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// 対象: /auth/github/callback でのログイン確認メールゲート、および
// GET /auth/email-confirm (確認リンククリック後のログイン完了エンドポイント)。
// EVP固有のロジック(D1アクセス・Resend送信・トークンのライフサイクル)は
// utils/emailConfirmGate.ts に集約されており(振る舞いは emailConfirmGate.test.ts で検証)、
// index.ts 側は runEmailConfirmGate / resolveEmailConfirmToken の結果に従って
// 分岐するだけの薄いグルーコードになっていることをここでは確認する。
describe('OAuthログインのメール確認ゲート(index.ts配線)', () => {
  const src = readFileSync('src/index.ts', 'utf8');

  it('/auth/github/callback はJWT発行前にrunEmailConfirmGateの結果で分岐する', () => {
    const callbackIdx = src.indexOf("app.get('/auth/github/callback'");
    const gateIdx = src.indexOf('await runEmailConfirmGate(', callbackIdx);
    const finalizeIdx = src.indexOf('await finalizeGithubLogin(c, {', callbackIdx);
    expect(callbackIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeGreaterThan(callbackIdx);
    expect(finalizeIdx).toBeGreaterThan(gateIdx);
  });

  it('確認メール送信に失敗した場合は握りつぶさずgateResult.errorStatusをそのまま返す', () => {
    const idx = src.indexOf('Failed to send login confirmation email');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 200);
    expect(snippet).toContain('gateResult.errorStatus');
  });

  it('GET /auth/email-confirm が登録されている', () => {
    expect(src).toContain("app.get('/auth/email-confirm'");
  });

  it('/auth/email-confirm はresolveEmailConfirmTokenの結果で分岐しfinalizeGithubLoginを呼ぶ', () => {
    const idx = src.indexOf("app.get('/auth/email-confirm'");
    const endIdx = src.indexOf('\n});', idx);
    const fn = src.slice(idx, endIdx);
    expect(fn).toContain('await resolveEmailConfirmToken(c.env.DB, confirmToken)');
    expect(fn).toContain('await finalizeGithubLogin(c, {');
  });

  it('index.ts はEVP固有ロジック(savePendingLogin等のD1操作)を自前で持たない(utils/emailConfirmGateへ集約済み)', () => {
    expect(src).not.toContain('async function savePendingLogin');
    expect(src).not.toContain('async function consumePendingLogin');
    expect(src).not.toContain('async function isEmailConfirmLoginEnabled');
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
