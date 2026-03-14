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
import { getRepositoriesPage } from './views/repositories';
import { getGitHubAccessToken, getGitHubLatestCommit, getGitHubTokenScopes, getGitHubUser, getGitHubUserEmail, getGitHubUserRepos, GitHubTokenScopesError } from './utils/github';
import { getCookieValue, getCookieValues } from './utils/cookie';
import { verifyResendWebhookSignature } from './utils/resendWebhook';
import { postSlackMessage } from './utils/slack';
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
  SLACK_SIGNING_SECRET?: string;
  SLACK_OAUTH_TOKEN?: string;
  SLACK_CLIENT_SECRET?: string;
  SLACK_CLIENT_ID?: string;
  SLACK_CHANNEL_ID?: string;
  SESSION_IDLE_TIMEOUT_SECONDS?: string;
  RESEND_WEBHOOK_DEDUP_TTL_SECONDS?: string;
};

// コンテキスト変数の型定義
type Variables = {
  user: JWTPayload;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const resendWebhookDedupCache = new Map<string, number>();

/**
 * CSRFを防ぐためのOAuth stateトークンを生成
 */
function generateOAuthState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const verifier = base64UrlEncode(verifierBytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}

function resolveIdleTimeoutSeconds(envValue: string | undefined, sessionDurationSeconds: number): number {
  const parsed = Number(envValue);
  const defaultIdle = 30 * 60;
  let idleSeconds = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : defaultIdle;
  if (idleSeconds > sessionDurationSeconds) {
    idleSeconds = sessionDurationSeconds;
  }
  return idleSeconds;
}

function resolveResendDedupTtlSeconds(envValue: string | undefined): number {
  const parsed = Number(envValue);
  const defaultTtl = 10 * 60;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultTtl;
  }
  return Math.floor(parsed);
}

function normalizeGitHubApiMessage(message: string): string {
  const normalized = message.trim().toLowerCase();
  switch (normalized) {
    case 'bad credentials':
      return '認証情報が無効です';
    case 'requires authentication':
      return '認証が必要です';
    case 'not found':
      return '対象が見つかりません';
    case 'validation failed':
      return '入力内容が不正です';
    case 'resource not accessible by integration':
      return '権限が不足しています';
    case 'api rate limit exceeded':
      return 'APIのレート制限に達しました';
    default:
      return message;
  }
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
  sessionDuration: string,
  githubAccessToken?: string
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
        SET timezone = ?, session_duration = ?, last_login_at = ?, current_login_at = ?, updated_at = ?, github_access_token = ?
        WHERE user_id = ?
      `).bind(timezone, sessionDuration, lastLoginAt, now, now, githubAccessToken ?? null, userId).run();
    } else {
      await db.prepare(`
        INSERT INTO user_sessions (user_id, timezone, session_duration, last_login_at, current_login_at, updated_at, github_access_token)
        VALUES (?, ?, ?, NULL, ?, ?, ?)
      `).bind(userId, timezone, sessionDuration, now, now, githubAccessToken ?? null).run();
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
  githubAccessToken?: string | null;
} | null> {
  if (!db) {
    return null;
  }

  try {
    const result = await db.prepare(
      'SELECT timezone, session_duration, last_login_at, github_access_token FROM user_sessions WHERE user_id = ?'
    ).bind(userId).first<{
      timezone: string;
      session_duration: string;
      last_login_at: string | null;
      github_access_token: string | null;
    }>();

    if (!result) {
      return null;
    }

    return {
      timezone: result.timezone,
      sessionDuration: result.session_duration,
      lastLoginAt: result.last_login_at,
      githubAccessToken: result.github_access_token,
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
app.use('/*', async (c, next) => {
  await next();

  const headers = c.res.headers;
  if (!headers.has('Content-Security-Policy')) {
    headers.set(
      'Content-Security-Policy',
      "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
    );
  }
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
});

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

const GITHUB_OAUTH_SCOPE = 'read:user user:email repo';

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
app.get('/auth/github', async (c) => {
  const clientId = c.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return c.json({ error: 'GitHub OAuth is not configured' }, 500);
  }

  const url = new URL(c.req.url);
  const redirectUri = `${url.protocol}//${url.host}/github/callback`;

  // CSRF保護用のstateトークンを生成
  const state = generateOAuthState();
  const pkce = await generatePkcePair();

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', GITHUB_OAUTH_SCOPE);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', pkce.challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  // stateをHttpOnlyクッキーに保存（5分間有効）
  const redirectHeaders = new Headers({
    'Location': authUrl.toString(),
  });
  redirectHeaders.append('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`);
  redirectHeaders.append('Set-Cookie', `oauth_pkce=${pkce.verifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`);

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
    const pkceVerifier = getCookieValue(cookieHeader, 'oauth_pkce');

    if (!state || !savedState || state !== savedState) {
      logger.warn('OAuth state mismatch - possible CSRF attempt', {
        hasState: !!state,
        hasSavedState: !!savedState,
      });
      return c.json({ error: 'Invalid state parameter. Please try logging in again.' }, 400);
    }
    if (!pkceVerifier) {
      return c.json({ error: 'Missing PKCE verifier. Please try logging in again.' }, 400);
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
    const accessToken = await getGitHubAccessToken(code, clientId, clientSecret, redirectUri, pkceVerifier);

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
    await updateUserSession(c.env.DB, userId, timezone, sessionDuration, accessToken);

    const sessionDurationSeconds = getSessionDurationSeconds(sessionDuration);
    const idleTimeoutSeconds = resolveIdleTimeoutSeconds(c.env.SESSION_IDLE_TIMEOUT_SECONDS, sessionDurationSeconds);

    // JWTトークンを生成
    const token = await createJWT(
      {
        sub: githubUser.login,
        name: githubUser.name || githubUser.login,
        email: email || undefined,
        github_id: githubUser.id,
        github_access_token: c.env.DB ? undefined : accessToken,
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
    redirectHeaders.append('Set-Cookie', `last_activity=${Date.now()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${idleTimeoutSeconds}`);
    redirectHeaders.append('Set-Cookie', `show_welcome_message=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=60`);
    // 使用済みのoauth_stateクッキーを削除
    redirectHeaders.append('Set-Cookie', `oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
    redirectHeaders.append('Set-Cookie', `oauth_pkce=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);

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
  redirectHeaders.append('Set-Cookie', 'last_activity=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  redirectHeaders.append('Set-Cookie', 'user_timezone=; Path=/; Secure; SameSite=Lax; Max-Age=0');
  redirectHeaders.append('Set-Cookie', 'user_session_duration=; Path=/; Secure; SameSite=Lax; Max-Age=0');
  redirectHeaders.append('Set-Cookie', 'oauth_pkce=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');

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
app.get('/settings', authMiddleware, async (c) => {
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

  const userSession = await getUserSession(c.env.DB, user.sub);
  const accessToken = userSession?.githubAccessToken ?? user.github_access_token ?? undefined;

  let grantedScopes: string[] | null = null;
  let scopesError: string | null = null;
  const clientId = c.env.GITHUB_CLIENT_ID;
  const clientSecret = c.env.GITHUB_CLIENT_SECRET;

  if (accessToken && clientId && clientSecret) {
    try {
      grantedScopes = await getGitHubTokenScopes({ accessToken, clientId, clientSecret });
    } catch (error) {
      logger.warn('Failed to fetch GitHub token scopes', {
        userId: user.sub,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      if (error instanceof GitHubTokenScopesError) {
        const suffix = error.apiMessage ? `: ${normalizeGitHubApiMessage(error.apiMessage)}` : '';
        scopesError = `付与スコープを取得できませんでした (HTTP ${error.status})${suffix}`;
      } else {
        scopesError = '付与スコープを取得できませんでした';
      }
    }
  } else if (!accessToken) {
    scopesError = 'アクセストークンが保存されていません';
  } else {
    scopesError = 'GitHub OAuth 設定が不足しています';
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
    githubScopes: GITHUB_OAUTH_SCOPE,
    githubGrantedScopes: grantedScopes,
    githubScopeError: scopesError,
  }));
});

/**
 * リポジトリページ（ログインが必要だが未ログイン時はトップへ）
 */
app.get('/repositories', optionalAuthMiddleware, async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.redirect('/', 302);
  }

  const userSession = await getUserSession(c.env.DB, user.sub);
  const accessToken = userSession?.githubAccessToken ?? undefined;

  let repositories: {
    name: string;
    htmlUrl: string;
    description?: string | null;
    language?: string | null;
    stars: number;
    forks: number;
    updatedAt: string;
    isPrivate: boolean;
    latestCommitSha?: string | null;
    latestCommitUrl?: string | null;
  }[] = [];
  let errorMessage: string | null = null;

  try {
    let repos = await getGitHubUserRepos({ username: user.sub, accessToken });
    repositories = await Promise.all(repos.map(async (repo) => {
      const updatedAt = repo.updated_at
        ? new Date(repo.updated_at).toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
        : '不明';
      const owner = repo.owner?.login || (repo.full_name ? repo.full_name.split('/')[0] : user.sub);
      const latestCommit = owner
        ? await getGitHubLatestCommit({ owner, repo: repo.name, accessToken })
        : null;
      return {
        name: repo.name,
        htmlUrl: repo.html_url,
        description: repo.description,
        language: repo.language,
        stars: repo.stargazers_count ?? 0,
        forks: repo.forks_count ?? 0,
        updatedAt,
        isPrivate: repo.private,
        latestCommitSha: latestCommit?.sha ?? null,
        latestCommitUrl: latestCommit?.html_url ?? null,
      };
    }));
  } catch (error) {
    if (accessToken) {
      try {
        const repos = await getGitHubUserRepos({ username: user.sub });
        repositories = await Promise.all(repos.map(async (repo) => {
          const updatedAt = repo.updated_at
            ? new Date(repo.updated_at).toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
            : '不明';
          const owner = repo.owner?.login || (repo.full_name ? repo.full_name.split('/')[0] : user.sub);
          const latestCommit = owner
            ? await getGitHubLatestCommit({ owner, repo: repo.name })
            : null;
          return {
            name: repo.name,
            htmlUrl: repo.html_url,
            description: repo.description,
            language: repo.language,
            stars: repo.stargazers_count ?? 0,
            forks: repo.forks_count ?? 0,
            updatedAt,
            isPrivate: repo.private,
            latestCommitSha: latestCommit?.sha ?? null,
            latestCommitUrl: latestCommit?.html_url ?? null,
          };
        }));
      } catch (fallbackError) {
        logger.error('Failed to fetch GitHub repositories', {
          userId: user.sub,
          error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
        });
        errorMessage = 'リポジトリ一覧を取得できませんでした。時間をおいて再度お試しください。';
      }
    } else {
      logger.error('Failed to fetch GitHub repositories', {
        userId: user.sub,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      errorMessage = 'リポジトリ一覧を取得できませんでした。時間をおいて再度お試しください。';
    }
  }

  return c.html(getRepositoriesPage({
    username: user.sub,
    name: user.name,
    repositories,
    errorMessage,
  }));
});

// =====================================================
// API エンドポイント
// =====================================================

/**
 * Resend webhook受信用エンドポイント
 * イベントタイプを/lib/resend-webhook.shtml?event=xxxへGETで通知し、Resendへのレスポンスを返す
 */
app.post('/webhook/resend', async (c) => {
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

  const resendEventId = c.req.header('svix-id')?.trim();
  if (resendEventId) {
    const nowMs = Date.now();
    const dedupTtlSeconds = resolveResendDedupTtlSeconds(c.env.RESEND_WEBHOOK_DEDUP_TTL_SECONDS);
    const expiresAt = nowMs + dedupTtlSeconds * 1000;

    for (const [key, expiry] of resendWebhookDedupCache.entries()) {
      if (expiry <= nowMs) {
        resendWebhookDedupCache.delete(key);
      }
    }

    if (resendWebhookDedupCache.has(resendEventId)) {
      logger.warn('Duplicate Resend webhook detected', { resendEventId });
      return c.json({ error: 'Duplicate webhook' }, 409);
    }

    resendWebhookDedupCache.set(resendEventId, expiresAt);
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

  const slackConfig = {
    signingSecret: c.env.SLACK_SIGNING_SECRET,
    oauthToken: c.env.SLACK_OAUTH_TOKEN,
    clientSecret: c.env.SLACK_CLIENT_SECRET,
    clientId: c.env.SLACK_CLIENT_ID,
    channelId: c.env.SLACK_CHANNEL_ID,
  };

  const deliveryStatus = eventType === 'email.delivered'
    ? '送信完了'
    : (eventType === 'email.failed' || eventType === 'email.bounced' ? '失敗' : null);

  if (deliveryStatus) {
    const missingSlackVars = Object.entries(slackConfig)
      .filter(([, value]) => !value || value.trim().length === 0)
      .map(([key]) => key);

    if (missingSlackVars.length > 0) {
      logger.error('Slack notification skipped due to missing configuration', {
        missing: missingSlackVars,
      });
    } else if (slackConfig.oauthToken && slackConfig.channelId) {
      try {
        const data = payload?.data ?? {};
        const from = typeof data.from === 'string' && data.from.trim().length > 0 ? data.from : 'unknown';
        const to = Array.isArray(data.to) && data.to.length > 0
          ? data.to.join(', ')
          : (typeof data.to === 'string' && data.to.trim().length > 0 ? data.to : 'unknown');
        const subject = typeof data.subject === 'string' && data.subject.trim().length > 0 ? data.subject : 'unknown';

        const slackText = [
          `Resend: ${deliveryStatus}`,
          `from: ${from}`,
          `to: ${to}`,
          `件名: ${subject}`,
        ].join('\n');

        const slackResult = await postSlackMessage({
          token: slackConfig.oauthToken,
          channel: slackConfig.channelId,
          text: slackText,
        });

        if (!slackResult.ok) {
          logger.error('Slack notification failed for Resend webhook', {
            eventType,
            error: slackResult.error,
            status: slackResult.status,
          });
        }
      } catch (error) {
        logger.error('Slack notification errored for Resend webhook', {
          eventType,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  const notifyUrl = new URL('https://mynw.nekomaneki.work/lib/resend-webhook.shtml');
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
