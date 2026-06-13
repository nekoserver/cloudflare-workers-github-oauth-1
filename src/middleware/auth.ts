/**
 * 認証ミドルウェア
 */

import { Context, Next } from 'hono';
import { verifyJWT, extractBearerToken, JWTPayload } from '../utils/jwt';
import { getSessionExpiredPage } from '../views/session-expired';
import { getCookieValue } from '../utils/cookie';
import { postSlackMessage } from '../utils/slack';
import { getSessionDurationSeconds } from '../utils/session';
import { resolveIdleTimeoutSeconds, type Bindings, type Variables } from '../types';

// Contextに認証ユーザー情報を追加
export interface AuthContext {
  user: JWTPayload;
}

/**
 * AuthorizationヘッダーまたはCookieからトークンを取得する
 */
function getToken(c: Context): { token: string; source: 'header' | 'cookie' } | null {
  const authHeader = c.req.header('Authorization');
  const bearerToken = extractBearerToken(authHeader);
  if (bearerToken) return { token: bearerToken, source: 'header' };

  const cookieHeader = c.req.header('Cookie');
  const cookieToken = getCookieValue(cookieHeader, 'auth_token');
  if (!cookieToken) return null;
  return { token: cookieToken, source: 'cookie' };
}

function parseTimestampMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * JWT認証ミドルウェア
 * Authorizationヘッダーまたはクッキーからトークンを取得し、検証します
 */
export async function authMiddleware(c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  const tokenInfo = getToken(c);
  let idleTimeoutToSet: number | null = null;
  let lastActivityToSet: number | null = null;

  // BearerトークンなしでAcceptヘッダーにtext/htmlが含まれる場合はブラウザからのリクエスト
  const acceptHeader = c.req.header('Accept') ?? '';
  const isBrowserRequest = !authHeader && acceptHeader.includes('text/html');

  if (!tokenInfo) {
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

  const payload = await verifyJWT(tokenInfo.token, secret);
  if (!payload) {
    // 不審なアクセス: 無効なJWTトークンでのアクセス試行をSlackに通知
    const slackToken = c.env.SLACK_OAUTH_TOKEN;
    const slackChannel = c.env.SLACK_CHANNEL_ID;
    if (slackToken && slackChannel) {
      const path = c.req.path;
      const method = c.req.method;
      const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
      postSlackMessage({
        token: slackToken,
        channel: slackChannel,
        text: `[セキュリティ警告] 無効なJWTトークンによるアクセス試行\nパス: ${method} ${path}\nIP: ${ip}\nソース: ${tokenInfo.source}`,
      }).catch(() => { /* 通知失敗は無視 */ });
    }
    if (isBrowserRequest) {
      return c.html(getSessionExpiredPage(), 401);
    }
    return c.json({ error: '無効なトークンです' }, 401);
  }

  if (tokenInfo.source === 'cookie') {
    const nowMs = Date.now();
    const cookieHeader = c.req.header('Cookie');
    const lastActivity = parseTimestampMs(getCookieValue(cookieHeader, 'last_activity'));
    const remainingSeconds = Math.max(payload.exp - Math.floor(nowMs / 1000), 0);
    const configuredDuration = getCookieValue(cookieHeader, 'user_session_duration');
    const idleFromSettings = configuredDuration ? getSessionDurationSeconds(configuredDuration) : undefined;
    const idleTimeoutSeconds = resolveIdleTimeoutSeconds(
      c.env.SESSION_IDLE_TIMEOUT_SECONDS,
      remainingSeconds,
      idleFromSettings
    );

    // last_activity Cookie が消えている場合は D1 の last_activity_at をフォールバックに使う
    let effectiveLastActivity: number | null = lastActivity;
    if (!effectiveLastActivity && c.env.DB) {
      const row = await c.env.DB.prepare(
        'SELECT last_activity_at FROM user_sessions WHERE user_id = ?'
      ).bind(payload.sub).first<{ last_activity_at: string | null }>();
      if (row?.last_activity_at) {
        effectiveLastActivity = new Date(row.last_activity_at).getTime();
      }
    }

    if (!effectiveLastActivity || nowMs - effectiveLastActivity > idleTimeoutSeconds * 1000) {
      const clearHeaders = new Headers();
      clearHeaders.append('Set-Cookie', 'auth_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
      clearHeaders.append('Set-Cookie', 'last_activity=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
      clearHeaders.append('Set-Cookie', 'login_timestamp=; Path=/; Secure; SameSite=Lax; Max-Age=0');

      if (isBrowserRequest) {
        clearHeaders.set('Content-Type', 'text/html; charset=utf-8');
        return new Response(getSessionExpiredPage(), {
          status: 401,
          headers: clearHeaders,
        });
      }
      clearHeaders.set('Content-Type', 'application/json; charset=utf-8');
      return new Response(JSON.stringify({ error: 'セッションの有効期限が切れました' }), {
        status: 401,
        headers: clearHeaders,
      });
    }

    idleTimeoutToSet = idleTimeoutSeconds;
    lastActivityToSet = nowMs;

    // D1 に last_activity_at を書き込む（5分スロットリング、fire-and-forget）
    const D1_WRITE_THRESHOLD_MS = 5 * 60 * 1000;
    if (c.env.DB && (!lastActivity || nowMs - lastActivity > D1_WRITE_THRESHOLD_MS)) {
      c.env.DB.prepare(
        'UPDATE user_sessions SET last_activity_at = ? WHERE user_id = ?'
      ).bind(new Date(nowMs).toISOString(), payload.sub).run().catch(() => {});
    }
  }

  // Contextに認証ユーザー情報を設定
  c.set('user', payload);

  await next();

  if (idleTimeoutToSet && lastActivityToSet) {
    c.res.headers.append(
      'Set-Cookie',
      `last_activity=${lastActivityToSet}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${idleTimeoutToSet}`
    );
  }
}

/**
 * オプショナル認証ミドルウェア
 * Authorizationヘッダーまたはクッキーのトークンがあれば検証するが、なくてもエラーにしない
 */
export async function optionalAuthMiddleware(c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) {
  const tokenInfo = getToken(c);

  if (tokenInfo) {
    const secret = c.env.JWT_SECRET;
    if (secret) {
      const payload = await verifyJWT(tokenInfo.token, secret);
      if (payload) {
        c.set('user', payload);
      }
    }
  }

  await next();
}
