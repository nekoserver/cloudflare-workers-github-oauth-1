import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// 対象: GET /api/email-verify-test。ログインユーザー自身のメールアドレス宛に
// Resendでテストメールを1通送るだけの動作確認用エンドポイント。
// RESEND_API_KEY 未設定時はデフォルトOFF(オプション機能)として振る舞う。
describe('GET /api/email-verify-test', () => {
  const src = readFileSync('src/index.ts', 'utf8');

  it('認証必須で登録されている', () => {
    expect(src).toContain("app.get('/api/email-verify-test', authMiddleware");
  });

  it('RESEND_API_KEY未設定時はenabled:falseを返しAPIを呼ばない(デフォルトOFF)', () => {
    const idx = src.indexOf("app.get('/api/email-verify-test'");
    const fn = src.slice(idx, src.indexOf('\n});', idx));
    expect(fn).toContain('if (!apiKey) return jsonUtf8({ enabled: false');
  });

  it('ログインユーザー自身のメールアドレス(user.email)のみを宛先にし、別の宛先入力は受け付けない', () => {
    const idx = src.indexOf("app.get('/api/email-verify-test'");
    const fn = src.slice(idx, src.indexOf('\n});', idx));
    expect(fn).toContain('sendTestEmailResend(apiKey, user.email)');
    expect(fn).not.toContain("c.req.query('to')");
    expect(fn).not.toContain("c.req.query('email')");
  });
});
