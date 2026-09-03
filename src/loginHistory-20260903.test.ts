import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import {
  isValidLoginMethod,
  loginMethodLabel,
  LOGIN_METHOD_GITHUB_OAUTH,
  LOGIN_METHOD_PUBLIC_KEY,
} from './utils/loginHistory';
import { buildAuthRedirectHeaders } from './utils/emailConfirm';

const indexSrc = fs.readFileSync(path.join(__dirname, 'index.ts'), 'utf-8');

// 対象: ログイン方式(GitHub OAuth / 公開鍵チャレンジ署名)の記録・画面表示。
// user_sessions.last_login_method(移行0123) と login_history テーブル(移行0124)に
// ログイン方式を記録し、/welcome ページで直近ログインの方式を差別化表示する。
//
// 故障シナリオ:
//   (1) 未知の値(将来の方式追加や壊れたデータ)をそのままGitHub OAuthのラベルとして
//       誤表示してしまう(これは意図した挙動: フォールバック先を明示してテストする)
//   (2) isValidLoginMethodが型ガードとして機能せず、不正な値がDBに書き込まれる

describe('isValidLoginMethod', () => {
  it('github_oauth / public_key を有効と判定する', () => {
    expect(isValidLoginMethod(LOGIN_METHOD_GITHUB_OAUTH)).toBe(true);
    expect(isValidLoginMethod(LOGIN_METHOD_PUBLIC_KEY)).toBe(true);
  });

  it('未知の文字列・非文字列は無効と判定する', () => {
    expect(isValidLoginMethod('password')).toBe(false);
    expect(isValidLoginMethod(null)).toBe(false);
    expect(isValidLoginMethod(undefined)).toBe(false);
    expect(isValidLoginMethod(123)).toBe(false);
  });
});

describe('buildAuthRedirectHeaders: login_method Cookie', () => {
  it('loginMethod省略時はgithub_oauthをセットする', () => {
    const headers = buildAuthRedirectHeaders({
      token: 'jwt', sessionDurationSeconds: 3600, idleTimeoutSeconds: 900,
      sessionDuration: '1h', returnToPath: '/welcome',
    });
    const cookies = headers.getSetCookie ? headers.getSetCookie() : [];
    expect(cookies.some(c => c.startsWith('login_method=github_oauth;'))).toBe(true);
  });

  it('loginMethod=public_key指定時はそのままセットする', () => {
    const headers = buildAuthRedirectHeaders({
      token: 'jwt', sessionDurationSeconds: 3600, idleTimeoutSeconds: 900,
      sessionDuration: '1h', returnToPath: '/welcome', loginMethod: LOGIN_METHOD_PUBLIC_KEY,
    });
    const cookies = headers.getSetCookie ? headers.getSetCookie() : [];
    expect(cookies.some(c => c.startsWith('login_method=public_key;'))).toBe(true);
  });
});

// 回帰テスト: finalizeGithubLogin/finalizePasskeyLoginの実装時に、
// buildAuthRedirectHeadersへ渡すloginMethod定数を取り違えて
// (finalizePasskeyLoginがGITHUB_OAUTHを、finalizeGithubLoginが未設定を渡す)
// 一度誤って実装してしまったため、ソースレベルで固定する。
describe('finalizeGithubLogin/finalizePasskeyLoginが正しいloginMethodを渡す', () => {
  it('finalizeGithubLoginはLOGIN_METHOD_GITHUB_OAUTHを渡す', () => {
    const start = indexSrc.indexOf('async function finalizeGithubLogin');
    const end = indexSrc.indexOf('async function finalizePasskeyLogin');
    const body = indexSrc.slice(start, end);
    expect(body).toContain('loginMethod: LOGIN_METHOD_GITHUB_OAUTH');
    expect(body).not.toContain('loginMethod: LOGIN_METHOD_PUBLIC_KEY');
    expect(body).toContain('recordLoginMethod(c.env.DB, params.githubLogin, LOGIN_METHOD_GITHUB_OAUTH)');
  });

  it('finalizePasskeyLoginはLOGIN_METHOD_PUBLIC_KEYを渡す', () => {
    const start = indexSrc.indexOf('async function finalizePasskeyLogin');
    const end = indexSrc.indexOf('// D1データベースのユーザー設定を更新');
    const body = indexSrc.slice(start, end);
    expect(body).toContain('loginMethod: LOGIN_METHOD_PUBLIC_KEY');
    expect(body).not.toContain('loginMethod: LOGIN_METHOD_GITHUB_OAUTH');
    expect(body).toContain('recordLoginMethod(c.env.DB, params.userId, LOGIN_METHOD_PUBLIC_KEY)');
  });
});

describe('loginMethodLabel', () => {
  it('public_keyは🔐公開鍵(パスキー)ラベルを返す', () => {
    expect(loginMethodLabel(LOGIN_METHOD_PUBLIC_KEY)).toBe('🔐 公開鍵(パスキー)');
  });

  it('github_oauthは🐙GitHub OAuthラベルを返す', () => {
    expect(loginMethodLabel(LOGIN_METHOD_GITHUB_OAUTH)).toBe('🐙 GitHub OAuth');
  });

  it('未知の値・null・undefinedはGitHub OAuthラベルにフォールバックする', () => {
    expect(loginMethodLabel('unknown')).toBe('🐙 GitHub OAuth');
    expect(loginMethodLabel(null)).toBe('🐙 GitHub OAuth');
    expect(loginMethodLabel(undefined)).toBe('🐙 GitHub OAuth');
  });
});
