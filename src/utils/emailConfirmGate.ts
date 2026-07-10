import { escapeHtml } from './html';
import { sendLoginConfirmEmail } from './emailVerify';
import {
  PENDING_LOGIN_TTL_MS,
  isPendingLoginExpired,
  shouldGateLoginOnEmailConfirmation,
  type PendingLoginRecord,
} from './emailConfirm';

/**
 * OAuthログインのメール確認ゲート(EVP)一式。D1アクセス・Resend送信・保留トークンの
 * ライフサイクル・確認待ち/エラーページのHTMLをすべてこのファイルに集約する。
 * 呼び出し側(index.ts)は runEmailConfirmGate / resolveEmailConfirmToken の
 * 戻り値に従って分岐するだけでよく、EVP固有のロジックを持たない。
 */

export async function isEmailConfirmLoginEnabled(db: D1Database | undefined): Promise<boolean> {
  if (!db) return false;
  try {
    const row = await db.prepare(
      'SELECT email_confirm_login_enabled FROM notification_settings WHERE id = 1'
    ).first<{ email_confirm_login_enabled: number }>();
    return !!row?.email_confirm_login_enabled;
  } catch {
    return false;
  }
}

export async function savePendingLogin(db: D1Database | undefined, record: PendingLoginRecord): Promise<boolean> {
  if (!db) return false;
  try {
    await db.prepare(
      `INSERT INTO email_confirm_tokens
       (token, github_login, github_name, github_id, email, github_access_token, granted_scopes, timezone, session_duration, return_to, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      record.token,
      record.githubLogin,
      record.githubName,
      record.githubId,
      record.email,
      record.githubAccessToken,
      record.grantedScopes,
      record.timezone,
      record.sessionDuration,
      record.returnToPath,
      record.createdAt,
      record.expiresAt
    ).run();
    return true;
  } catch {
    return false;
  }
}

export async function consumePendingLogin(db: D1Database | undefined, token: string): Promise<PendingLoginRecord | null> {
  if (!db) return null;
  try {
    const row = await db.prepare(
      `SELECT token, github_login as githubLogin, github_name as githubName, github_id as githubId,
              email, github_access_token as githubAccessToken, granted_scopes as grantedScopes,
              timezone, session_duration as sessionDuration, return_to as returnToPath,
              created_at as createdAt, expires_at as expiresAt, consumed_at as consumedAt
       FROM email_confirm_tokens WHERE token = ?`
    ).bind(token).first<PendingLoginRecord & { consumedAt: string | null }>();
    if (!row || row.consumedAt) return null;
    await db.prepare('UPDATE email_confirm_tokens SET consumed_at = ? WHERE token = ?').bind(new Date().toISOString(), token).run();
    return row;
  } catch {
    return null;
  }
}

function renderLoginConfirmPendingPage(email: string): string {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>ログイン確認メール送信</title></head><body>
<h1>確認メールを送信しました</h1>
<p>${escapeHtml(email)} 宛にログイン確認メールを送信しました。メール内のリンクをクリックしてログインを完了してください。</p>
<p>リンクの有効期限は30分です。</p>
</body></html>`;
}

export function renderLoginConfirmErrorPage(message: string): string {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>ログイン確認エラー</title></head><body>
<h1>ログインを完了できませんでした</h1>
<p>${escapeHtml(message)}</p>
<p><a href="/auth/github">もう一度ログインする</a></p>
</body></html>`;
}

export type GithubLoginIdentity = {
  githubLogin: string;
  githubName: string;
  githubId: number;
  email?: string;
  accessToken: string;
  grantedScopes: string;
  timezone: string;
  sessionDuration: string;
  returnToPath: string;
};

export type EmailConfirmGateResult =
  | { gated: false }
  | { gated: true; html: string; status?: number }
  | { gated: true; errorStatus: number; errorMessage: string };

/**
 * ログイン確定前にメール確認を挟むべきかを判定し、必要ならResendで確認メールを
 * 送信して保留ログインをD1へ保存する。gated=falseならそのままログインを確定してよい。
 */
export async function runEmailConfirmGate(
  db: D1Database | undefined,
  resendApiKey: string | undefined,
  confirmUrlBase: string,
  identity: GithubLoginIdentity
): Promise<EmailConfirmGateResult> {
  const enabled = await isEmailConfirmLoginEnabled(db);
  if (!shouldGateLoginOnEmailConfirmation(enabled, resendApiKey, identity.email)) {
    return { gated: false };
  }

  const token = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PENDING_LOGIN_TTL_MS);
  const saved = await savePendingLogin(db, {
    token,
    githubLogin: identity.githubLogin,
    githubName: identity.githubName,
    githubId: identity.githubId,
    email: identity.email as string,
    githubAccessToken: identity.accessToken,
    grantedScopes: identity.grantedScopes,
    timezone: identity.timezone,
    sessionDuration: identity.sessionDuration,
    returnToPath: identity.returnToPath,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  if (!saved) {
    // トークン保存に失敗した場合(D1未接続等)はメール確認をスキップし、従来どおり即ログインを完了する
    return { gated: false };
  }

  const confirmUrl = `${confirmUrlBase}/auth/email-confirm?token=${token}`;
  const sendResult = await sendLoginConfirmEmail(resendApiKey as string, identity.email as string, confirmUrl);
  if (!sendResult.ok) {
    return { gated: true, errorStatus: 502, errorMessage: 'ログイン確認メールの送信に失敗しました。しばらくしてから再度お試しください。' };
  }

  return { gated: true, html: renderLoginConfirmPendingPage(identity.email as string) };
}

export type ResolveEmailConfirmTokenResult =
  | { ok: true; record: PendingLoginRecord }
  | { ok: false; message: string };

/**
 * 確認メール内リンクのクリックを受け取り、保留ログインを一度きり消費して取り出す。
 */
export async function resolveEmailConfirmToken(db: D1Database | undefined, token: string): Promise<ResolveEmailConfirmTokenResult> {
  const record = await consumePendingLogin(db, token);
  if (!record) {
    return { ok: false, message: 'このリンクは無効か、既に使用されています。もう一度ログインをやり直してください。' };
  }
  if (isPendingLoginExpired(record)) {
    return { ok: false, message: 'このリンクの有効期限が切れています。もう一度ログインをやり直してください。' };
  }
  return { ok: true, record };
}
