import { describe, it, expect } from 'vitest';
import { isPendingLoginExpired, PENDING_LOGIN_TTL_MS, shouldGateLoginOnEmailConfirmation, buildAuthRedirectHeaders } from './emailConfirm';

describe('isPendingLoginExpired', () => {
  it('有効期限内であればfalseを返す', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const record = { expiresAt: new Date(now.getTime() + 1000).toISOString() };
    expect(isPendingLoginExpired(record, now)).toBe(false);
  });

  it('有効期限ちょうどに切れていればtrueを返す', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const record = { expiresAt: now.toISOString() };
    expect(isPendingLoginExpired(record, now)).toBe(true);
  });

  it('有効期限を過ぎていればtrueを返す', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const record = { expiresAt: new Date(now.getTime() - 1000).toISOString() };
    expect(isPendingLoginExpired(record, now)).toBe(true);
  });

  it('TTLは30分(1800000ms)である', () => {
    expect(PENDING_LOGIN_TTL_MS).toBe(30 * 60 * 1000);
  });
});

describe('shouldGateLoginOnEmailConfirmation', () => {
  it('enabled=true かつ RESEND_API_KEYとemailが両方揃っている場合はtrue(確認メールを挟む)', () => {
    expect(shouldGateLoginOnEmailConfirmation(true, 're_xxx', 'a@example.com')).toBe(true);
  });

  it('enabled=false(デフォルトOFF)なら他が揃っていてもfalse(即ログイン、ロックアウト防止)', () => {
    expect(shouldGateLoginOnEmailConfirmation(false, 're_xxx', 'a@example.com')).toBe(false);
  });

  it('enabled=true でも RESEND_API_KEYが未設定なら確認手段が無いためfalse(従来どおり即ログイン)', () => {
    expect(shouldGateLoginOnEmailConfirmation(true, undefined, 'a@example.com')).toBe(false);
  });

  it('enabled=true でも GitHub側にemailが無い場合も送り先が無いためfalse(従来どおり即ログイン)', () => {
    expect(shouldGateLoginOnEmailConfirmation(true, 're_xxx', undefined)).toBe(false);
  });

  it('すべて無い場合もfalse', () => {
    expect(shouldGateLoginOnEmailConfirmation(false, undefined, undefined)).toBe(false);
  });
});

describe('buildAuthRedirectHeaders', () => {
  const params = {
    token: 'jwt-token-value',
    sessionDurationSeconds: 3600,
    idleTimeoutSeconds: 900,
    sessionDuration: '1h',
    returnToPath: '/welcome',
  };

  it('Locationヘッダーにreturn_to先をセットする', () => {
    const headers = buildAuthRedirectHeaders(params);
    expect(headers.get('Location')).toBe('/welcome');
  });

  it('auth_tokenクッキーにHttpOnly/Secure/SameSite=Laxを付与する(セキュリティ属性は削らない)', () => {
    const headers = buildAuthRedirectHeaders(params);
    const cookies = headers.getSetCookie ? headers.getSetCookie() : [];
    const authCookie = cookies.find(c => c.startsWith('auth_token='));
    expect(authCookie).toContain('HttpOnly');
    expect(authCookie).toContain('Secure');
    expect(authCookie).toContain('SameSite=Lax');
    expect(authCookie).toContain(`Max-Age=${params.sessionDurationSeconds}`);
  });

  it('user_session_duration クッキーに Max-Age=31536000(1年)をセットする(再ログイン時にセッション長設定を保持するため)', () => {
    const headers = buildAuthRedirectHeaders(params);
    const cookies = headers.getSetCookie ? headers.getSetCookie() : [];
    const cookie = cookies.find(c => c.startsWith('user_session_duration='));
    expect(cookie).toContain('user_session_duration=1h');
    expect(cookie).toContain('Max-Age=31536000');
  });

  it('使用済みのOAuthクッキー(oauth_state/oauth_pkce/oauth_return_to)を削除する', () => {
    const headers = buildAuthRedirectHeaders(params);
    const cookies = headers.getSetCookie ? headers.getSetCookie() : [];
    for (const name of ['oauth_state', 'oauth_pkce', 'oauth_return_to']) {
      const cookie = cookies.find(c => c.startsWith(`${name}=`));
      expect(cookie).toContain('Max-Age=0');
    }
  });
});
