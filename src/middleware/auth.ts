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
 * D1 から取得したセッション行が強制 revoke 済みかどうかを返す
 */
export function checkRevoked(row: { revoked_at: string | null | undefined; last_activity_at: string | null }): boolean {
  return !!row.revoked_at;
}

function notifyRevokedAccess(c: Context<{ Bindings: Bindings; Variables: Variables }>, source: string, userId: string) {
  const slackToken = c.env.SLACK_OAUTH_TOKEN;
  const slackChannel = c.env.SLACK_CHANNEL_ID;
  if (!slackToken || !slackChannel) return;
  const path = c.req.path;
  const method = c.req.method;
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
  postSlackMessage({
    token: slackToken,
    channel: slackChannel,
    text: `[セキュリティ警告] revoke済みセッションによるアクセス試行\nユーザー: ${userId}\nパス: ${method} ${path}\nIP: ${ip}\nソース: ${source}`,
  }).catch(() => {});
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

    // last_activity Cookie が消えている場合 or revoke チェックのために D1 を参照する
    let effectiveLastActivity: number | null = lastActivity;
    let idleTimeoutFromDB: number | undefined;
    if (c.env.DB) {
      let row: { last_activity_at: string | null; revoked_at: string | null; idle_timeout_seconds?: number | null } | null = null;
      try {
        row = await c.env.DB.prepare(
          'SELECT last_activity_at, revoked_at, idle_timeout_seconds FROM user_sessions WHERE user_id = ?'
        ).bind(payload.sub).first<{ last_activity_at: string | null; revoked_at: string | null; idle_timeout_seconds: number | null }>();
      } catch {
        // migration 未適用時のフォールバック
        row = await c.env.DB.prepare(
          'SELECT last_activity_at, revoked_at FROM user_sessions WHERE user_id = ?'
        ).bind(payload.sub).first<{ last_activity_at: string | null; revoked_at: string | null }>().catch(() => null);
      }
      if (row && checkRevoked(row)) {
        notifyRevokedAccess(c, tokenInfo.source, payload.sub);
        const clearHeaders = new Headers();
        clearHeaders.append('Set-Cookie', 'auth_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
        clearHeaders.append('Set-Cookie', 'last_activity=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
        clearHeaders.append('Set-Cookie', 'login_timestamp=; Path=/; Secure; SameSite=Lax; Max-Age=0');
        if (isBrowserRequest) {
          clearHeaders.set('Content-Type', 'text/html; charset=utf-8');
          return new Response(getSessionExpiredPage(), { status: 401, headers: clearHeaders });
        }
        clearHeaders.set('Content-Type', 'application/json; charset=utf-8');
        return new Response(JSON.stringify({ error: 'セッションが無効化されました' }), { status: 401, headers: clearHeaders });
      }
      if (!effectiveLastActivity && row?.last_activity_at) {
        effectiveLastActivity = new Date(row.last_activity_at).getTime();
      }
      if (row?.idle_timeout_seconds && row.idle_timeout_seconds > 0) {
        idleTimeoutFromDB = row.idle_timeout_seconds;
      }
    }

    const idleTimeoutSeconds = resolveIdleTimeoutSeconds(
      c.env.SESSION_IDLE_TIMEOUT_SECONDS,
      remainingSeconds,
      idleTimeoutFromDB ?? idleFromSettings
    );

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

  // Bearer トークンの場合も revoke チェックを行う（Cookie ブロックでは既にチェック済み）
  if (tokenInfo.source === 'header' && c.env.DB) {
    const row = await c.env.DB.prepare(
      'SELECT revoked_at FROM user_sessions WHERE user_id = ?'
    ).bind(payload.sub).first<{ revoked_at: string | null }>();
    if (row && row.revoked_at) {
      notifyRevokedAccess(c, 'header', payload.sub);
      return c.json({ error: 'セッションが無効化されました' }, 401);
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
