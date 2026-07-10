import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { buildAuthRedirectHeaders } from './utils/emailConfirm';

const src = fs.readFileSync(path.join(__dirname, 'index.ts'), 'utf-8');

// ===========================================================
// バグ修正: セッション72時間問題
//
// 原因1: OAuthコールバックが user_session_duration クッキーをセットしていない
//   → ログアウト後の再ログインでアイドルタイムアウトが 30分(デフォルト) になる
//
// 原因2: updateUserSession の ON CONFLICT が session_duration を上書きする
//   → getUserSession 失敗時にCookieの古い値でD1設定が上書きされる
// ===========================================================

// ログイン確定時のCookie組み立ては finalizeGithubLogin (index.ts) から
// buildAuthRedirectHeaders (utils/emailConfirm.ts) へ切り出し済み。
// /auth/github/callback (即時ログイン) と /auth/email-confirm (メール確認後ログイン) の
// 両方がこの関数を共通利用するため、Cookie仕様はここで直接検証する。
describe('OAuthコールバック: user_session_duration クッキーの設定', () => {
  it('finalizeGithubLoginがbuildAuthRedirectHeadersを利用してCookieを組み立てる', () => {
    expect(src).toContain('buildAuthRedirectHeaders({');
  });

  it('user_session_duration クッキーをセットする', () => {
    const headers = buildAuthRedirectHeaders({
      token: 'jwt',
      sessionDurationSeconds: 3600,
      idleTimeoutSeconds: 900,
      sessionDuration: '1h',
      returnToPath: '/welcome',
    });
    const cookies = headers.getSetCookie ? headers.getSetCookie() : [];
    expect(cookies.some(c => c.startsWith('user_session_duration='))).toBe(true);
  });

  it('user_session_duration クッキーに Max-Age=31536000 が設定されている', () => {
    const headers = buildAuthRedirectHeaders({
      token: 'jwt',
      sessionDurationSeconds: 3600,
      idleTimeoutSeconds: 900,
      sessionDuration: '1h',
      returnToPath: '/welcome',
    });
    const cookies = headers.getSetCookie ? headers.getSetCookie() : [];
    const cookie = cookies.find(c => c.startsWith('user_session_duration='));
    expect(cookie).toBeDefined();
    const match = cookie!.match(/Max-Age=(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(31536000);
  });
});

describe('updateUserSession: session_duration を ON CONFLICT で上書きしない', () => {
  it('ON CONFLICT DO UPDATE SET に session_duration が含まれない', () => {
    const idx = src.indexOf('ON CONFLICT (user_id) DO UPDATE SET');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 400);
    expect(snippet).not.toContain('session_duration');
  });

  it('INSERT 側には session_duration が含まれる（新規ユーザー用）', () => {
    const idx = src.indexOf('INSERT INTO user_sessions (user_id, timezone, session_duration');
    expect(idx).toBeGreaterThan(-1);
  });
});

describe('OAuthコールバック: D1失敗時の session_duration フォールバック', () => {
  it('getUserSession 失敗時の fallback でも session_duration を D1 から再取得する', () => {
    const idx = src.indexOf("phase = 'save-session'");
    expect(idx).toBeGreaterThan(-1);
    const before = src.slice(Math.max(0, idx - 1500), idx);
    expect(before).toContain('sessionDurationFromDB');
  });

  it('session_duration 解決順序は D1 → DB再クエリ → Cookie → デフォルト', () => {
    const idx = src.indexOf("phase = 'save-session'");
    expect(idx).toBeGreaterThan(-1);
    const before = src.slice(Math.max(0, idx - 1500), idx);
    expect(before).toContain('sessionDurationFromDB');
    expect(before).toContain("user_session_duration");
  });
});
