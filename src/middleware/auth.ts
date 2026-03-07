/**
 * 認証ミドルウェア
 */

import { Context, Next } from 'hono';
import { verifyJWT, extractBearerToken, JWTPayload } from '../utils/jwt';
import { getSessionExpiredPage } from '../views/session-expired';
import { getCookieValue } from '../utils/cookie';

// Bindings type
type Bindings = {
  JWT_SECRET: string;
  ENVIRONMENT: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
};

// Variables type
type Variables = {
  user: JWTPayload;
};

// Contextに認証ユーザー情報を追加
export interface AuthContext {
  user: JWTPayload;
}

/**
 * AuthorizationヘッダーまたはCookieからトークンを取得する
 */
function getToken(c: Context): string | null {
  const authHeader = c.req.header('Authorization');
  const bearerToken = extractBearerToken(authHeader);
  if (bearerToken) return bearerToken;

  const cookieHeader = c.req.header('Cookie');
  return getCookieValue(cookieHeader, 'auth_token');
}

/**
 * JWT認証ミドルウェア
 * Authorizationヘッダーまたはクッキーからトークンを取得し、検証します
 */
export async function authMiddleware(c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  const token = getToken(c);

  // BearerトークンなしでAcceptヘッダーにtext/htmlが含まれる場合はブラウザからのリクエスト
  const acceptHeader = c.req.header('Accept') ?? '';
  const isBrowserRequest = !authHeader && acceptHeader.includes('text/html');

  if (!token) {
    if (isBrowserRequest) {
      return c.html(getSessionExpiredPage(), 401);
    }
    return c.json({ error: '認証が必要です' }, 401);
  }

  const secret = c.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET is not configured');
    return c.json({ error: 'サーバー設定エラー' }, 500);
  }

  const payload = await verifyJWT(token, secret);
  if (!payload) {
    if (isBrowserRequest) {
      return c.html(getSessionExpiredPage(), 401);
    }
    return c.json({ error: '無効なトークンです' }, 401);
  }

  // Contextに認証ユーザー情報を設定
  c.set('user', payload);

  await next();
}

/**
 * オプショナル認証ミドルウェア
 * Authorizationヘッダーまたはクッキーのトークンがあれば検証するが、なくてもエラーにしない
 */
export async function optionalAuthMiddleware(c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) {
  const token = getToken(c);

  if (token) {
    const secret = c.env.JWT_SECRET;
    if (secret) {
      const payload = await verifyJWT(token, secret);
      if (payload) {
        c.set('user', payload);
      }
    }
  }

  await next();
}
