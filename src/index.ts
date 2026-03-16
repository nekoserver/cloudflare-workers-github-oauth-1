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
import { getUserInfoPage } from './views/userinfo';
import { getGitHubAccessToken, getGitHubLatestCommit, getGitHubTokenScopes, getGitHubUser, getGitHubUserEmail, getGitHubUserRepos, GitHubTokenScopesError, buildRepoInstallationPermissionsMap, RepoInstallationPermissions, getGitHubUserInstallationsWithDiag, getGitHubInstallationRepos } from './utils/github';
import { getCookieValue, getCookieValues } from './utils/cookie';
import { verifyResendWebhookSignature } from './utils/resendWebhook';
import { verifyGitHubWebhookSignature } from './utils/githubWebhook';
import { postSlackMessage } from './utils/slack';
import * as logger from './utils/logger';
import { resolveIdleTimeoutSeconds, type Bindings, type Variables, type GitHubWebhookInstallationPayload, type ResendWebhookPayload } from './types';

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

/**
 * D1からインストール権限を読み取り、リポジトリ名→権限のマップとして返す
 * Webhookで保存されたデータを使用するため、GitHub APIへのアクセスなしで高速に返せる
 */
async function getInstallationPermissionsFromD1(
  db: D1Database | undefined
): Promise<{ permissions: Record<string, { permissions: Record<string, string>; repositorySelection: string }>; allPermissions: Record<string, string> | null } | null> {
  if (!db) return null;

  try {
    const rows = await db.prepare(
      'SELECT installation_id, repo_name, repository_selection, permissions FROM installation_permissions'
    ).all<{
      installation_id: number;
      repo_name: string | null;
      repository_selection: string;
      permissions: string;
    }>();

    if (!rows.results || rows.results.length === 0) return null;

    const result: Record<string, { permissions: Record<string, string>; repositorySelection: string }> = {};
    let allPermissions: Record<string, string> | null = null;

    for (const row of rows.results) {
      const perms = JSON.parse(row.permissions) as Record<string, string>;
      if (row.repo_name === null) {
        // repo_name が NULL → "all repositories" インストール
        allPermissions = perms;
      } else {
        result[row.repo_name] = {
          permissions: perms,
          repositorySelection: row.repository_selection,
        };
      }
    }

    return { permissions: result, allPermissions };
  } catch (error) {
    logger.error('Failed to read installation permissions from D1', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
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
    const setupAction = c.req.query('setup_action');

    // GitHub App「Install App」フローの処理
    // Install Appフローはstate/PKCEを伴わないため、OAuth認証フローとは別に処理する
    if (setupAction === 'install') {
      const installationId = c.req.query('installation_id');
      logger.info('GitHub App installation callback received', {
        installationId,
        hasCode: !!code,
      });
      // インストール完了後、ログイン済みならwelcomeへ、未ログインならトップへ
      const cookieHeader = c.req.header('Cookie');
      const authToken = getCookieValue(cookieHeader, 'auth_token');
      return c.redirect(authToken ? '/welcome' : '/', 302);
    }

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

    // ログイン失敗をSlackに通知
    const slackToken = c.env.SLACK_OAUTH_TOKEN;
    const slackChannel = c.env.SLACK_CHANNEL_ID;
    if (slackToken && slackChannel) {
      const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      postSlackMessage({
        token: slackToken,
        channel: slackChannel,
        text: `[セキュリティ警告] ログイン失敗\nエラー: ${errMsg}\nIP: ${ip}`,
      }).catch(() => { /* 通知失敗は無視 */ });
    }

    return c.json({
      error: 'Authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * 権限の再認証（既存のGitHub OAuthグラントを取り消してから再認証）
 * スコープが不足している場合にユーザーを新しい認可画面に誘導する
 */
app.get('/auth/github/reauthorize', authMiddleware, async (c) => {
  const user = c.get('user');
  const clientId = c.env.GITHUB_CLIENT_ID;
  const clientSecret = c.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return c.json({ error: 'GitHub OAuth is not configured' }, 500);
  }

  // D1からアクセストークンを取得
  const userSession = await getUserSession(c.env.DB, user.sub);
  const accessToken = userSession?.githubAccessToken ?? user.github_access_token ?? undefined;

  if (accessToken) {
    // 既存のOAuthグラントを取り消し（GitHub APIを利用）
    // これによりGitHubが次回の認証時に新しいスコープの承認画面を表示する
    try {
      await fetch(`https://api.github.com/applications/${encodeURIComponent(clientId)}/grant`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Cloudflare-Workers-GitHub-OAuth',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ access_token: accessToken }),
      });

      logger.info('Revoked GitHub OAuth grant for re-authorization', { userId: user.sub });
    } catch (error) {
      logger.warn('Failed to revoke GitHub OAuth grant', {
        userId: user.sub,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // 取り消しに失敗しても再認証フローは続行する
    }
  }

  // クッキーを削除してから /auth/github にリダイレクト
  const redirectHeaders = new Headers({ 'Location': '/auth/github' });
  redirectHeaders.append('Set-Cookie', 'auth_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  redirectHeaders.append('Set-Cookie', 'login_timestamp=; Path=/; Secure; SameSite=Lax; Max-Age=0');
  redirectHeaders.append('Set-Cookie', 'last_activity=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');

  return new Response(null, { status: 302, headers: redirectHeaders });
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

  // リポジトリ総数を取得
  const accessToken = userSession?.githubAccessToken ?? user.github_access_token ?? undefined;
  let repoCount: number | null = null;
  if (accessToken || user.sub) {
    try {
      const repos = await getGitHubUserRepos({ username: user.sub, accessToken });
      repoCount = repos.length;
    } catch (error) {
      logger.warn('Failed to fetch repo count for welcome page', {
        userId: user.sub,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return c.html(getWelcomePage({
    username: user.sub,
    name: user.name,
    email: user.email,
    lastLoginAt: formattedLastLogin,
    showWelcomeMessage,
    repoCount,
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
 * ユーザー情報ページ（認証が必要）
 */
app.get('/userinfo', authMiddleware, async (c) => {
  const user = c.get('user');

  return c.html(getUserInfoPage({
    username: user.sub,
    name: user.name,
    email: user.email,
    githubId: user.github_id,
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
  const accessToken = userSession?.githubAccessToken ?? user.github_access_token ?? undefined;

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

  // トークンのスコープを取得
  let grantedScopes: string[] | null = null;
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
    }
  }

  // GitHub App インストール権限をリポジトリごとに取得（D1優先、APIフォールバック）
  let repoInstallationPermissions: Map<string, RepoInstallationPermissions> = new Map();
  const d1Perms = await getInstallationPermissionsFromD1(c.env.DB);
  if (d1Perms) {
    // D1 のデータをMap形式に変換
    for (const [repoName, info] of Object.entries(d1Perms.permissions)) {
      repoInstallationPermissions.set(repoName, {
        installationId: 0,
        permissions: info.permissions,
        repositorySelection: info.repositorySelection as 'all' | 'selected',
      });
    }
    if (d1Perms.allPermissions) {
      repoInstallationPermissions.set('__all__0', {
        installationId: 0,
        permissions: d1Perms.allPermissions,
        repositorySelection: 'all',
      });
    }
  } else if (accessToken) {
    try {
      repoInstallationPermissions = await buildRepoInstallationPermissionsMap(accessToken);
    } catch (error) {
      logger.warn('Failed to fetch installation permissions from GitHub API', {
        userId: user.sub,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

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

  // リポジトリごとのインストール権限をシリアライズ可能な形に変換
  // "__all__" キーを持つインストールがある場合は、全リポジトリにその権限を適用
  const repoPermissionsMap: Record<string, { permissions: Record<string, string>; repositorySelection: string }> = {};
  let allReposPermissions: Record<string, string> | null = null;
  for (const [key, value] of repoInstallationPermissions.entries()) {
    if (key.startsWith('__all__')) {
      allReposPermissions = value.permissions;
    } else {
      repoPermissionsMap[key] = {
        permissions: value.permissions,
        repositorySelection: value.repositorySelection,
      };
    }
  }
  // "All repositories" インストールがある場合、全リポジトリにその権限を適用
  if (allReposPermissions) {
    for (const repo of repositories) {
      if (!repoPermissionsMap[repo.name]) {
        repoPermissionsMap[repo.name] = {
          permissions: allReposPermissions,
          repositorySelection: 'all',
        };
      }
    }
  }

  return c.html(getRepositoriesPage({
    username: user.sub,
    name: user.name,
    repositories,
    errorMessage,
    grantedScopes,
    repoPermissions: repoPermissionsMap,
  }));
});

// =====================================================
// Webhook エンドポイント
// =====================================================

/**
 * GitHub App Webhook 受信用エンドポイント
 * installation イベントを受信し、D1 に権限を保存、Slack に通知
 */
app.post('/webhook/github', async (c) => {
  const webhookSecret = c.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('GitHub webhook secret is not configured');
    return c.json({ error: 'Webhook endpoint is not available' }, 500);
  }

  const rawBody = await c.req.text();
  const signatureHeader = c.req.header('X-Hub-Signature-256');

  const verification = await verifyGitHubWebhookSignature(rawBody, signatureHeader, webhookSecret);
  if (!verification.success) {
    logger.warn('Rejected GitHub webhook', {
      reason: verification.reason,
      path: c.req.path,
    });
    return c.json({ error: 'Unauthorized webhook' }, 401);
  }

  const eventType = c.req.header('X-GitHub-Event') ?? 'unknown';
  const deliveryId = c.req.header('X-GitHub-Delivery') ?? 'unknown';

  let payload: GitHubWebhookInstallationPayload;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return c.json({ error: 'Invalid webhook payload' }, 400);
  }

  const action = typeof payload?.action === 'string' ? payload.action : 'unknown';

  logger.info('GitHub webhook received', { eventType, action, deliveryId });

  // installation イベントを処理
  if (eventType === 'installation' || eventType === 'installation_repositories') {
    const db = c.env.DB;
    const installation = payload?.installation;

    if (installation && typeof installation.id === 'number' && db) {
      const installationId = installation.id;
      const permissions = installation.permissions ?? {};
      const repositorySelection = installation.repository_selection ?? 'selected';
      const now = new Date().toISOString();

      try {
        if (action === 'deleted' || action === 'suspend') {
          // インストール削除 or 一時停止 → D1 から該当レコードを削除
          await db.prepare(
            'DELETE FROM installation_permissions WHERE installation_id = ?'
          ).bind(installationId).run();

          logger.info('Deleted installation permissions from D1', { installationId, action });
        } else if (action === 'created' || action === 'new_permissions_accepted' || action === 'unsuspend') {
          // インストール作成 or 権限承認 or 再開
          if (repositorySelection === 'all') {
            // "All repositories" → repo_name を NULL で1レコード
            await db.prepare(`
              INSERT INTO installation_permissions (installation_id, repo_name, repository_selection, permissions, updated_at)
              VALUES (?, NULL, ?, ?, ?)
              ON CONFLICT(installation_id, repo_name) DO UPDATE SET
                repository_selection = excluded.repository_selection,
                permissions = excluded.permissions,
                updated_at = excluded.updated_at
            `).bind(installationId, repositorySelection, JSON.stringify(permissions), now).run();
          } else {
            // "Selected repositories" → リポジトリごとにレコード
            const repos = payload?.repositories ?? payload?.repositories_added ?? [];
            if (Array.isArray(repos)) {
              for (const repo of repos) {
                const repoName = repo.name ?? repo.full_name?.split('/').pop();
                if (!repoName) continue;
                await db.prepare(`
                  INSERT INTO installation_permissions (installation_id, repo_name, repository_selection, permissions, updated_at)
                  VALUES (?, ?, ?, ?, ?)
                  ON CONFLICT(installation_id, repo_name) DO UPDATE SET
                    repository_selection = excluded.repository_selection,
                    permissions = excluded.permissions,
                    updated_at = excluded.updated_at
                `).bind(installationId, repoName, repositorySelection, JSON.stringify(permissions), now).run();
              }
            }
          }

          // repositories_removed があれば削除
          const removedRepos = payload?.repositories_removed ?? [];
          if (Array.isArray(removedRepos)) {
            for (const repo of removedRepos) {
              const repoName = repo.name ?? repo.full_name?.split('/').pop();
              if (!repoName) continue;
              await db.prepare(
                'DELETE FROM installation_permissions WHERE installation_id = ? AND repo_name = ?'
              ).bind(installationId, repoName).run();
            }
          }

          logger.info('Updated installation permissions in D1', {
            installationId,
            action,
            repositorySelection,
            permissionKeys: Object.keys(permissions),
          });
        }
      } catch (error) {
        logger.error('Failed to update installation permissions in D1', {
          installationId,
          action,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Slack 通知: GitHub App インストール変更
    const slackToken = c.env.SLACK_OAUTH_TOKEN;
    const slackChannel = c.env.SLACK_CHANNEL_ID;
    if (slackToken && slackChannel) {
      const sender = payload?.sender?.login ?? 'unknown';
      const appSlug = installation?.app_slug ?? 'unknown';
      const actionMessage: Record<string, string> = {
        created: 'インストールされました',
        deleted: 'アンインストールされました',
        suspend: '一時停止されました',
        unsuspend: '再開されました',
        new_permissions_accepted: 'パーミッション変更が承認されました',
      };
      const message = actionMessage[action] ?? `${action}が実行されました`;
      const repoSelection = installation?.repository_selection ?? 'unknown';

      const slackText = [
        `GitHub OAuth App で${message}`,
        `対象App: ${appSlug}`,
        `管理者: ${sender}`,
        `対象: ${repoSelection === 'all' ? '全リポジトリ' : '選択リポジトリ'}`,
      ].join('\n');

      try {
        await postSlackMessage({ token: slackToken, channel: slackChannel, text: slackText });
      } catch (error) {
        logger.error('Slack notification failed for GitHub webhook', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  return c.json({ success: true, event: eventType, action }, 200);
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

  let payload: ResendWebhookPayload;
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

/**
 * インストール権限の最新データを返す（ページ読み込み時の差分チェック用）
 */
app.get('/api/repo-permissions', authMiddleware, async (c) => {
  const user = c.get('user');

  // D1 から読み取り（Webhook で保存されたデータ）
  const d1Data = await getInstallationPermissionsFromD1(c.env.DB);
  if (d1Data) {
    return c.json({ permissions: d1Data.permissions, allPermissions: d1Data.allPermissions, source: 'd1' });
  }

  // D1 にデータがない場合は GitHub API にフォールバック
  const userSession = await getUserSession(c.env.DB, user.sub);
  const accessToken = userSession?.githubAccessToken ?? user.github_access_token ?? undefined;

  if (!accessToken) {
    return c.json({ permissions: {} });
  }

  try {
    const installMap = await buildRepoInstallationPermissionsMap(accessToken);
    const result: Record<string, { permissions: Record<string, string>; repositorySelection: string }> = {};
    let allPerms: Record<string, string> | null = null;

    for (const [key, value] of installMap.entries()) {
      if (key.startsWith('__all__')) {
        allPerms = value.permissions;
      } else {
        result[key] = {
          permissions: value.permissions,
          repositorySelection: value.repositorySelection,
        };
      }
    }

    return c.json({ permissions: result, allPermissions: allPerms, source: 'api' });
  } catch (error) {
    logger.warn('Failed to fetch repo installation permissions', {
      userId: user.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ permissions: {} });
  }
});

// =====================================================
// 診断エンドポイント
// =====================================================

/**
 * D1接続診断（認証が必要）
 */
app.get('/api/debug/d1', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;

  const result: Record<string, unknown> = {
    db_binding_exists: !!db,
    user: user.sub,
  };

  if (!db) {
    return c.json({ ...result, error: 'DB binding is undefined - D1 is not bound' }, 500);
  }

  try {
    // テーブル存在確認
    const tables = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='user_sessions'"
    ).first();
    result.table_exists = !!tables;

    // カラム確認
    const columns = await db.prepare("PRAGMA table_info(user_sessions)").all();
    result.columns = columns.results?.map((col: Record<string, unknown>) => col.name) ?? [];

    // ユーザーのレコード確認
    const userRecord = await db.prepare(
      'SELECT user_id, timezone, session_duration, last_login_at, current_login_at, updated_at, display_name, CASE WHEN github_access_token IS NOT NULL THEN \'[SET]\' ELSE \'[NULL]\' END as token_status FROM user_sessions WHERE user_id = ?'
    ).bind(user.sub).first();
    result.user_record = userRecord ?? 'NOT FOUND';

    // 全レコード数
    const count = await db.prepare('SELECT COUNT(*) as cnt FROM user_sessions').first<{ cnt: number }>();
    result.total_records = count?.cnt ?? 0;

    // テスト書き込み
    const now = new Date().toISOString();
    try {
      await db.prepare(`
        INSERT INTO user_sessions (user_id, timezone, session_duration, current_login_at, updated_at)
        VALUES (?, 'UTC', '1h', ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET updated_at = ?
      `).bind(user.sub, now, now, now).run();
      result.test_write = 'SUCCESS';
    } catch (writeError) {
      result.test_write = 'FAILED';
      result.test_write_error = writeError instanceof Error ? writeError.message : 'Unknown error';
    }

    // テスト書き込み後の確認
    const afterWrite = await db.prepare(
      'SELECT user_id, timezone, session_duration, current_login_at, updated_at FROM user_sessions WHERE user_id = ?'
    ).bind(user.sub).first();
    result.after_test_write = afterWrite ?? 'NOT FOUND';
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    result.stack = error instanceof Error ? error.stack : undefined;
  }

  return c.json(result);
});

/**
 * GitHub App インストール権限の診断（認証が必要）
 * GET /user/installations の生レスポンスを確認できる
 */
app.get('/api/debug/installations', authMiddleware, async (c) => {
  const user = c.get('user');
  const userSession = await getUserSession(c.env.DB, user.sub);
  const accessToken = userSession?.githubAccessToken ?? user.github_access_token ?? undefined;

  if (!accessToken) {
    return c.json({ error: 'アクセストークンが保存されていません', user: user.sub });
  }

  const result: Record<string, unknown> = { user: user.sub };

  // Step 1: GET /user/installations
  const diag = await getGitHubUserInstallationsWithDiag(accessToken);
  result.installations_api = {
    status: diag.status,
    error: diag.error,
    total_count: diag.totalCount,
    installation_count: diag.installationCount,
  };

  if (!diag.installations || diag.installations.length === 0) {
    result.installations = [];
    result.repo_permissions = {};
    return c.json(result);
  }

  // Step 2: 各インストールの詳細
  const installDetails: Record<string, unknown>[] = [];
  for (const inst of diag.installations) {
    const detail: Record<string, unknown> = {
      id: inst.id,
      app_id: inst.app_id,
      app_slug: inst.app_slug,
      repository_selection: inst.repository_selection,
      permissions: inst.permissions,
    };

    if (inst.repository_selection !== 'all') {
      const repos = await getGitHubInstallationRepos(accessToken, inst.id);
      detail.repos = repos.map(r => ({ name: r.name, full_name: r.full_name, private: r.private }));
      detail.repo_count = repos.length;
    } else {
      detail.repos = '(all repositories)';
    }

    installDetails.push(detail);
  }
  result.installations = installDetails;

  // Step 3: buildRepoInstallationPermissionsMap の結果
  try {
    const permMap = await buildRepoInstallationPermissionsMap(accessToken);
    const serialized: Record<string, unknown> = {};
    for (const [key, value] of permMap.entries()) {
      serialized[key] = {
        installationId: value.installationId,
        permissions: value.permissions,
        repositorySelection: value.repositorySelection,
      };
    }
    result.repo_permissions = serialized;
  } catch (error) {
    result.repo_permissions_error = error instanceof Error ? error.message : 'Unknown error';
  }

  return c.json(result);
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
