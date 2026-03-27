import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSessionDurationSeconds, renewSession, type RenewSessionParams } from './session';
import type { JWTPayload } from './jwt';

describe('getSessionDurationSeconds', () => {
  it('1h → 3600秒', () => {
    expect(getSessionDurationSeconds('1h')).toBe(3600);
  });

  it('3h → 10800秒', () => {
    expect(getSessionDurationSeconds('3h')).toBe(10800);
  });

  it('8h → 28800秒', () => {
    expect(getSessionDurationSeconds('8h')).toBe(28800);
  });

  it('1d → 86400秒', () => {
    expect(getSessionDurationSeconds('1d')).toBe(86400);
  });

  it('3d → 259200秒', () => {
    expect(getSessionDurationSeconds('3d')).toBe(259200);
  });

  it('1w → 604800秒', () => {
    expect(getSessionDurationSeconds('1w')).toBe(604800);
  });

  it('不正値はデフォルト3600秒', () => {
    expect(getSessionDurationSeconds('invalid')).toBe(3600);
  });
});

describe('renewSession', () => {
  const mockUser: JWTPayload = {
    sub: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    github_id: 12345,
    iat: Math.floor(Date.now() / 1000) - 600,
    exp: Math.floor(Date.now() / 1000) + 3000,
  };

  const baseParams: RenewSessionParams = {
    currentUser: mockUser,
    newDuration: '1d',
    jwtSecret: 'test-secret-key-for-jwt-signing',
    idleTimeoutEnv: undefined,
  };

  it('新しいJWTトークンを生成する', async () => {
    const result = await renewSession(baseParams);
    expect(result.token).toBeTruthy();
    expect(result.token.split('.')).toHaveLength(3);
  });

  it('sessionDurationSecondsが新しい時間に設定される', async () => {
    const result = await renewSession(baseParams);
    expect(result.sessionDurationSeconds).toBe(86400);
  });

  it('idleTimeoutSecondsがデフォルト30分に設定される', async () => {
    const result = await renewSession(baseParams);
    expect(result.idleTimeoutSeconds).toBe(1800);
  });

  it('cookiesにauth_token・login_timestamp・last_activity・user_session_durationが含まれる', async () => {
    const result = await renewSession(baseParams);
    expect(result.cookies).toHaveLength(4);
    expect(result.cookies[0]).toMatch(/^auth_token=.+; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400$/);
    expect(result.cookies[1]).toMatch(/^login_timestamp=\d+; Path=\/; Secure; SameSite=Lax; Max-Age=86400$/);
    expect(result.cookies[2]).toMatch(/^last_activity=\d+; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=1800$/);
    expect(result.cookies[3]).toBe('user_session_duration=1d; Path=/; Secure; SameSite=Lax; Max-Age=31536000');
  });

  it('1wに変更するとMax-Ageが604800になる', async () => {
    const result = await renewSession({ ...baseParams, newDuration: '1w' });
    expect(result.sessionDurationSeconds).toBe(604800);
    expect(result.cookies[0]).toContain('Max-Age=604800');
  });

  it('github_access_tokenがあればJWTに含まれる', async () => {
    const userWithToken: JWTPayload = {
      ...mockUser,
      github_access_token: 'gho_test123',
    };
    const result = await renewSession({ ...baseParams, currentUser: userWithToken });
    expect(result.token).toBeTruthy();
    const [, payloadB64] = result.token.split('.');
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    expect(payload.github_access_token).toBe('gho_test123');
  });

  it('github_access_tokenがなければJWTに含まれない', async () => {
    const result = await renewSession(baseParams);
    const [, payloadB64] = result.token.split('.');
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    expect(payload.github_access_token).toBeUndefined();
  });
});
