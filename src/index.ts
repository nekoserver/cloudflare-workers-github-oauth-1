/**
 * Cloudflare Workers GitHub OAuth
 * GitHub OAuthとJWT認証の実装
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createJWT, JWTPayload } from './utils/jwt';
// NOTE: レートリミットはCloudflare WAFのRate Limiting Rulesで設定することを推奨します
// Cloudflare Workersはステートレスなため、アプリ内でのレートリミットには
// Durable ObjectsやKVなどの外部ストアが必要です
import { authMiddleware, optionalAuthMiddleware } from './middleware/auth';
import { getLoginPage } from './views/login';
import { getWelcomePage } from './views/welcome';
import { getSettingsPage } from './views/settings';
import { getGitHubAccessToken, getGitHubUser, getGitHubUserEmail } from './utils/github';
import { getCookieValue, getCookieValues } from './utils/cookie';
import { verifyResendWebhookSignature } from './utils/resendWebhook';
import * as logger from './utils/logger';

// 環境変数の型定義
type Bindings = {
  JWT_SECRET: string;
  ENVIRONMENT: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  DB?: D1Database;
  ANALYTICS?: AnalyticsEngineDataset;
  RESEND_WEBHOOK_SECRET?: string;
};

// コンテキスト変数の型定義
type Variables = {
  user: JWTPayload;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * CSRFを防ぐためのOAuth stateトークンを生成
 */
function generateOAuthState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// セッション有効期限の文字列を秒数に変換するヘルパー関数
function getSessionDurationSeconds(duration: string): number {
  switch (duration) {
    case '1h': return 3600;
    case '3h': return 10800;
    case '8h': return 28800;
    case '1d': return 86400;
    case '3d': return 259200;
    case '1w': return 604800;
    default: return 3600;
  }
}

// D1データベースにユーザーセッション情報を保存または更新
async function updateUserSession(
  db: D1Database | undefined,
  userId: string,
  timezone: string,
  sessionDuration: string
): Promise<string | null> {
  if (!db) {
    logger.warn('D1 database not available, skipping session update', { userId });
    return null;
  }

  const now = new Date().toISOString();

  try {
    const existing = await db.prepare(
      'SELECT last_login_at, current_login_at FROM user_sessions WHERE user_id = ?'
    ).bind(userId).first<{ last_login_at: string | null; current_login_at: string }>();

    let lastLoginAt: string | null = null;

    if (existing) {
      lastLoginAt = existing.current_login_at;
      await db.prepare(`
        UPDATE user_sessions
        SET timezone = ?, session_duration = ?, last_login_at = ?, current_login_at = ?, updated_at = ?
        WHERE user_id = ?
      `).bind(timezone, sessionDuration, lastLoginAt, now, now, userId).run();
    } else {
      await db.prepare(`
        INSERT INTO user_sessions (user_id, timezone, session_duration, last_login_at, current_login_at, updated_at)
        VALUES (?, ?, ?, NULL, ?, ?)
      `).bind(userId, timezone, sessionDuration, now, now).run();
    }

    return lastLoginAt;
  } catch (error) {
    logger.error('Error updating user session', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

// D1データベースからユーザーセッション情報を取得
async function getUserSession(db: D1Database | undefined, userId: string): Promise<{
  timezone: string;
  sessionDuration: string;
  lastLoginAt: string | null;
} | null> {
  if (!db) {
    return null;
  }

  try {
    const result = await db.prepare(
      'SELECT timezone, session_duration, last_login_at FROM user_sessions WHERE user_id = ?'
    ).bind(userId).first<{
      timezone: string;
      session_duration: string;
      last_login_at: string | null;
    }>();

    if (!result) {
      return null;
    }

    return {
      timezone: result.timezone,
      sessionDuration: result.session_duration,
      lastLoginAt: result.last_login_at,
    };
  } catch (error) {
    logger.error('Error getting user session', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

// D1データベースのユーザー設定を更新
async function updateUserSettings(
  db: D1Database | undefined,
  userId: string,
  field: 'timezone' | 'session_duration' | 'display_name',
  value: string
): Promise<boolean> {
  if (!db) {
    return true;
  }

  const now = new Date().toISOString();

  try {
    await db.prepare(`
      UPDATE user_sessions
      SET ${field} = ?, updated_at = ?
      WHERE user_id = ?
    `).bind(value, now, userId).run();
    return true;
  } catch (error) {
    logger.error('Error updating user settings', {
      userId,
      field,
      value,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

// CORSの設定
app.use('/*', cors());

// =====================================================
// ヘルスチェック
// =====================================================

/**
 * ヘルスチェックエンドポイント
 */
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
  });
});

// =====================================================
// 認証フロー
// =====================================================

/**
 * トップページ - GitHub OAuth ログインページ
 */
app.get('/', (c) => {
  const clientId = c.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return c.json({
      error: 'GitHub OAuth is not configured',
      message: 'GITHUB_CLIENT_ID environment variable is not set',
      apiEndpoints: {
        github_oauth: 'GET /auth/github',
        protected: 'GET /api/protected',
        profile: 'GET /api/profile',
      }
    }, 500);
  }

  return c.html(getLoginPage());
});

/**
 * GitHub OAuth認証開始（リダイレクト用エンドポイント）
 * CSRF対策のためstateパラメータを生成しクッキーに保存
 */
app.get('/auth/github', (c) => {
  const clientId = c.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return c.json({ error: 'GitHub OAuth is not configured' }, 500);
  }

  const url = new URL(c.req.url);
  const redirectUri = `${url.protocol}//${url.host}/github/callback`;

  // CSRF保護用のstateトークンを生成
  const state = generateOAuthState();

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'read:user user:email');
  authUrl.searchParams.set('state', state);

  // stateをHttpOnlyクッキーに保存（5分間有効）
  const redirectHeaders = new Headers({
    'Location': authUrl.toString(),
  });
  redirectHeaders.append('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`);

  return new Response(null, { status: 302, headers: redirectHeaders });
});

/**
 * GitHub OAuth コールバック
 * stateパラメータを検証してCSRF攻撃を防止
 */
app.get('/github/callback', async (c) => {
  try {
    const code = c.req.query('code');
    const error = c.req.query('error');
    const state = c.req.query('state');

    if (error) {
      return c.json({ error: `GitHub OAuth error: ${error}` }, 400);
    }

    if (!code) {
      return c.json({ error: 'No code provided' }, 400);
    }

    // stateパラメータの検証（CSRF対策）
    const cookieHeader = c.req.header('Cookie');
    const savedState = getCookieValue(cookieHeader, 'oauth_state');

    if (!state || !savedState || state !== savedState) {
      logger.warn('OAuth state mismatch - possible CSRF attempt', {
        hasState: !!state,
        hasSavedState: !!savedState,
      });
      return c.json({ error: 'Invalid state parameter. Please try logging in again.' }, 400);
    }

    const clientId = c.env.GITHUB_CLIENT_ID;
    const clientSecret = c.env.GITHUB_CLIENT_SECRET;
    const jwtSecret = c.env.JWT_SECRET;

    if (!clientId || !clientSecret) {
      return c.json({ error: 'GitHub OAuth is not configured' }, 500);
    }

    if (!jwtSecret) {
      return c.json({ error: 'JWT_SECRET is not configured' }, 500);
    }

    const url = new URL(c.req.url);
    const redirectUri = `${url.protocol}//${url.host}/github/callback`;

    // GitHubからアクセストークンを取得
    const accessToken = await getGitHubAccessToken(code, clientId, clientSecret, redirectUri);

    // GitHubユーザー情報を取得
    const githubUser = await getGitHubUser(accessToken);

    // メールアドレスを取得（user.emailがnullの場合に備えて）
    let email = githubUser.email;
    if (!email) {
      email = await getGitHubUserEmail(accessToken);
    }

    const userId = githubUser.login;

    // D1データベースからユーザー設定を取得
    const userSession = await getUserSession(c.env.DB, userId);

    let timezone = 'UTC';
    let sessionDuration = '1h';

    if (userSession) {
      timezone = userSession.timezone;
      sessionDuration = userSession.sessionDuration;
    } else {
      // 新規ユーザーの場合、クッキーから取得（もしあれば）
      const cookieVals = getCookieValues(cookieHeader, ['user_timezone', 'user_session_duration']);
      if (cookieVals['user_timezone']) {
        timezone = cookieVals['user_timezone'];
      }
      if (cookieVals['user_session_duration']) {
        sessionDuration = cookieVals['user_session_duration'];
      }
    }

    // D1にログイン情報を保存
    await updateUserSession(c.env.DB, userId, timezone, sessionDuration);

    const sessionDurationSeconds = getSessionDurationSeconds(sessionDuration);

    // JWTトークンを生成
    const token = await createJWT(
      {
        sub: githubUser.login,
        name: githubUser.name || githubUser.login,
        email: email || undefined,
        github_id: githubUser.id,
      },
      jwtSecret,
      sessionDurationSeconds
    );

    logger.info('GitHub OAuth authentication successful', {
      userId: githubUser.login,
      sessionDuration,
    });

    logger.recordMetric(c.env.ANALYTICS, 'auth_github_success', {
      userId: githubUser.login,
      timestamp: Date.now(),
    });

    // 認証成功後、クッキーをセットしつつ /welcome へリダイレクト
    // Headers API を使って複数の Set-Cookie を確実に付与する
    const redirectHeaders = new Headers({
      'Location': '/welcome',
    });
    redirectHeaders.append('Set-Cookie', `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${sessionDurationSeconds}`);
    redirectHeaders.append('Set-Cookie', `login_timestamp=${Date.now()}; Path=/; Secure; SameSite=Lax; Max-Age=${sessionDurationSeconds}`);
    redirectHeaders.append('Set-Cookie', `show_welcome_message=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=60`);
    // 使用済みのoauth_stateクッキーを削除
    redirectHeaders.append('Set-Cookie', `oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);

    return new Response(null, { status: 302, headers: redirectHeaders });
  } catch (error) {
    logger.error('GitHub OAuth callback error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    logger.recordMetric(c.env.ANALYTICS, 'auth_github_error', {
      error: error instanceof Error ? error.message : 'unknown',
      timestamp: Date.now(),
    });

    return c.json({
      error: 'Authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * ログアウト
 * サーバーサイドでHttpOnlyクッキーを削除してからログインページへリダイレクト
 */
app.get('/auth/logout', (c) => {
  const redirectHeaders = new Headers({
    'Location': '/',
  });
  // HttpOnlyクッキーはJavaScriptからは削除できないため、サーバーサイドで削除する
  redirectHeaders.append('Set-Cookie', 'auth_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  redirectHeaders.append('Set-Cookie', 'login_timestamp=; Path=/; Secure; SameSite=Lax; Max-Age=0');
  redirectHeaders.append('Set-Cookie', 'user_timezone=; Path=/; Secure; SameSite=Lax; Max-Age=0');
  redirectHeaders.append('Set-Cookie', 'user_session_duration=; Path=/; Secure; SameSite=Lax; Max-Age=0');

  return new Response(null, { status: 302, headers: redirectHeaders });
});

/**
 * ウェルカムページ（認証が必要）
 */
app.get('/welcome', authMiddleware, async (c) => {
  const user = c.get('user');

  const userSession = await getUserSession(c.env.DB, user.sub);

  let lastLoginAt: string | null = null;
  let timezone = 'UTC';

  if (userSession) {
    lastLoginAt = userSession.lastLoginAt;
    timezone = userSession.timezone;
  }

  let formattedLastLogin: string | null = null;
  if (lastLoginAt) {
    const lastLoginDate = new Date(lastLoginAt);
    if (timezone === 'JST') {
      const jstDate = new Date(lastLoginDate.getTime() + 9 * 60 * 60 * 1000);
      formattedLastLogin = jstDate.toISOString().replace('T', ' ').substring(0, 19) + ' JST';
    } else {
      formattedLastLogin = lastLoginDate.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    }
  }

  // show_welcome_message Cookieを読み取り、GitHubコールバック直後かどうか判定
  const cookieHeader = c.req.header('Cookie');
  const showWelcomeMessage = getCookieValue(cookieHeader, 'show_welcome_message') === '1';

  if (showWelcomeMessage) {
    c.header('Set-Cookie', `show_welcome_message=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  }

  return c.html(getWelcomePage({
    username: user.sub,
    name: user.name,
    email: user.email,
    lastLoginAt: formattedLastLogin,
    showWelcomeMessage,
  }));
});

/**
 * 設定ページ（認証が必要）
 */
app.get('/settings', authMiddleware, (c) => {
  const user = c.get('user');

  const cookieHeader = c.req.header('Cookie');
  const cookieVals = getCookieValues(cookieHeader, ['user_timezone', 'user_session_duration']);
  const timezone = cookieVals['user_timezone'] || 'UTC';
  const sessionDuration = cookieVals['user_session_duration'] || '1h';

  let issuedAt: string;
  let expiresAt: string;

  if (timezone === 'JST') {
    const issuedDate = new Date(user.iat * 1000 + 9 * 60 * 60 * 1000);
    const expiresDate = new Date(user.exp * 1000 + 9 * 60 * 60 * 1000);
    issuedAt = issuedDate.toISOString().replace('T', ' ').substring(0, 19) + ' JST';
    expiresAt = expiresDate.toISOString().replace('T', ' ').substring(0, 19) + ' JST';
  } else {
    const issuedDate = new Date(user.iat * 1000);
    const expiresDate = new Date(user.exp * 1000);
    issuedAt = issuedDate.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    expiresAt = expiresDate.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  }

  return c.html(getSettingsPage({
    username: user.sub,
    name: user.name,
    email: user.email,
    issuedAt,
    expiresAt,
    expiresAtTimestamp: user.exp,
    timezone,
    sessionDuration,
  }));
});

// =====================================================
// API エンドポイント
// =====================================================

/**
 * Resend webhook受信用エンドポイント
 * イベントタイプを/lib/resend-webhook.shtml?event=xxxへGETで通知し、Resendへのレスポンスを返す
 */
app.all('/webhook/resend', async (c) => {
  if (c.req.method !== 'POST') {
    logger.warn('Resend webhook received with unexpected method', {
      method: c.req.method,
      path: c.req.path,
    });
    return c.json({ error: 'Method Not Allowed' }, 405);
  }
  const webhookSecret = c.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('Resend webhook secret is not configured');
    return c.json({ error: 'Webhook endpoint is not available' }, 500);
  }

  const rawBody = await c.req.text();

  const verification = await verifyResendWebhookSignature(rawBody, {
    id: c.req.header('svix-id'),
    timestamp: c.req.header('svix-timestamp'),
    signature: c.req.header('svix-signature'),
  }, webhookSecret);

  if (!verification.success) {
    logger.warn('Rejected Resend webhook', {
      reason: verification.reason,
      path: c.req.path,
      method: c.req.method,
    });
    return c.json({ error: 'Unauthorized webhook' }, 401);
  }

  let payload: any;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch (error) {
    logger.warn('Unable to parse Resend webhook payload', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'Invalid webhook payload' }, 400);
  }

  const eventType = typeof payload?.type === 'string' && payload.type.trim().length > 0
    ? payload.type
    : 'unknown';

  logger.info('Resend webhook received', { eventType });

  const notifyUrl = new URL('/lib/resend-webhook.shtml', c.req.url);
  notifyUrl.searchParams.set('event', eventType);

  try {
    const proxyResponse = await fetch(notifyUrl.toString(), {
      method: 'GET',
    });

    if (!proxyResponse.ok) {
      logger.error('Proxy notification failed for Resend webhook', {
        eventType,
        status: proxyResponse.status,
        statusText: proxyResponse.statusText,
      });
      return c.json({ error: 'Failed to notify proxy target' }, 502);
    }
  } catch (error) {
    logger.error('Failed to reach proxy target for Resend webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
      eventType,
    });
    return c.json({ error: 'Failed to notify proxy target' }, 502);
  }

  return c.json({ success: true, event: eventType }, 200);
});

/**
 * API情報
 */
app.get('/api', (c) => {
  return c.json({
    message: 'Cloudflare Workers GitHub OAuth API',
    version: '1.0.0',
    authentication: {
      github_oauth: 'GET /auth/github',
      logout: 'GET /auth/logout',
    },
    endpoints: {
      public: [
        'GET /api',
        'GET /api/public',
        'GET /health',
      ],
      protected: [
        'GET /api/protected',
        'GET /api/profile',
        'PUT /api/profile',
      ],
    },
  });
});

/**
 * 公開エンドポイント（オプショナル認証）
 */
app.get('/api/public', optionalAuthMiddleware, (c) => {
  const user = c.get('user');

  if (user) {
    return c.json({
      message: 'これは公開エンドポイントです（認証済み）',
      user: {
        username: user.sub,
        name: user.name,
        email: user.email,
      },
    });
  }

  return c.json({
    message: 'これは公開エンドポイントです（未認証）',
    info: 'このエンドポイントは誰でもアクセスできます',
  });
});

/**
 * 保護されたエンドポイント
 */
app.get('/api/protected', authMiddleware, (c) => {
  const user = c.get('user');

  return c.json({
    message: '保護されたリソースへのアクセスに成功しました',
    user: {
      username: user.sub,
      name: user.name,
      email: user.email,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * ユーザープロフィール取得
 */
app.get('/api/profile', authMiddleware, (c) => {
  const user = c.get('user');

  return c.json({
    profile: {
      username: user.sub,
      name: user.name,
      email: user.email,
      issuedAt: new Date(user.iat * 1000).toISOString(),
      expiresAt: new Date(user.exp * 1000).toISOString(),
    },
  });
});

/**
 * プロフィール更新（表示名をD1データベースに保存）
 */
app.put('/api/profile', authMiddleware, async (c) => {
  const user = c.get('user');

  let body: { name?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'リクエストボディが不正です' }, 400);
  }

  const { name } = body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return c.json({ error: '名前は必須です' }, 400);
  }

  if (name.length > 100) {
    return c.json({ error: '名前は100文字以内にしてください' }, 400);
  }

  const success = await updateUserSettings(c.env.DB, user.sub, 'display_name', name.trim());

  if (!success) {
    return c.json({ error: 'データベースの更新に失敗しました' }, 500);
  }

  return c.json({
    message: 'プロフィールを更新しました',
    profile: {
      username: user.sub,
      name: name.trim(),
      email: user.email,
    },
  });
});

/**
 * タイムゾーン設定変更
 */
app.post('/api/settings/timezone', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { timezone } = await c.req.json();

    if (timezone !== 'UTC' && timezone !== 'JST') {
      return c.json({ error: '無効なタイムゾーンです' }, 400);
    }

    const success = await updateUserSettings(c.env.DB, user.sub, 'timezone', timezone);

    if (!success) {
      return c.json({ error: 'データベースの更新に失敗しました' }, 500);
    }

    c.header('Set-Cookie', `user_timezone=${timezone}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);

    return c.json({ message: 'タイムゾーンを変更しました', timezone }, 200);
  } catch (error) {
    const user = c.get('user');
    logger.error('Timezone update error', {
      userId: user?.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'タイムゾーンの変更に失敗しました' }, 500);
  }
});

/**
 * セッション有効期限設定変更
 */
app.post('/api/settings/session-duration', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { sessionDuration } = await c.req.json();

    const validDurations = ['1h', '3h', '8h', '1d', '3d', '1w'];
    if (!validDurations.includes(sessionDuration)) {
      return c.json({ error: '無効なセッション有効期限です' }, 400);
    }

    const success = await updateUserSettings(c.env.DB, user.sub, 'session_duration', sessionDuration);

    if (!success) {
      return c.json({ error: 'データベースの更新に失敗しました' }, 500);
    }

    c.header('Set-Cookie', `user_session_duration=${sessionDuration}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);

    return c.json({ message: 'セッション有効期限を変更しました', sessionDuration }, 200);
  } catch (error) {
    const user = c.get('user');
    logger.error('Session duration update error', {
      userId: user?.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'セッション有効期限の変更に失敗しました' }, 500);
  }
});

// =====================================================
// エラーハンドリング
// =====================================================

app.notFound((c) => {
  return c.json({ error: 'エンドポイントが見つかりません' }, 404);
});

app.onError((err, c) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
  });

  logger.recordMetric(c.env.ANALYTICS, 'unhandled_error', {
    path: c.req.path,
    method: c.req.method,
    timestamp: Date.now(),
  });

  return c.json({ error: 'サーバーエラーが発生しました' }, 500);
});

export default app;
