export const PENDING_LOGIN_TTL_MS = 30 * 60 * 1000;

export interface PendingLoginRecord {
  token: string;
  githubLogin: string;
  githubName: string;
  githubId: number;
  email: string;
  githubAccessToken: string;
  grantedScopes: string;
  timezone: string;
  sessionDuration: string;
  returnToPath: string;
  createdAt: string;
  expiresAt: string;
}

export function isPendingLoginExpired(record: Pick<PendingLoginRecord, 'expiresAt'>, now: Date = new Date()): boolean {
  return new Date(record.expiresAt).getTime() <= now.getTime();
}

/**
 * ログイン完了(JWT発行)の前にメール確認を挟むべきかを判定する。
 * RESEND_API_KEY 未設定、またはGitHub側からメールアドレスが取れない場合は
 * 確認手段が無いため従来どおり即ログインを完了する。
 */
export function shouldGateLoginOnEmailConfirmation(resendApiKey: string | undefined, email: string | undefined): boolean {
  return !!resendApiKey && !!email;
}

export interface AuthRedirectParams {
  token: string;
  sessionDurationSeconds: number;
  idleTimeoutSeconds: number;
  sessionDuration: string;
  returnToPath: string;
}

/**
 * ログイン完了時にセットするCookie群とリダイレクト先をまとめて組み立てる。
 * /auth/github/callback (即時ログイン) と /auth/email-confirm (確認後ログイン) の
 * 両方から共通利用するため、Headers生成を独立関数として切り出す。
 */
export function buildAuthRedirectHeaders(params: AuthRedirectParams): Headers {
  const headers = new Headers({ 'Location': params.returnToPath });
  headers.append('Set-Cookie', `auth_token=${params.token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${params.sessionDurationSeconds}`);
  headers.append('Set-Cookie', `login_timestamp=${Date.now()}; Path=/; Secure; SameSite=Lax; Max-Age=${params.sessionDurationSeconds}`);
  headers.append('Set-Cookie', `last_activity=${Date.now()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${params.idleTimeoutSeconds}`);
  headers.append('Set-Cookie', `user_session_duration=${params.sessionDuration}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);
  headers.append('Set-Cookie', `show_welcome_message=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=60`);
  headers.append('Set-Cookie', `oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  headers.append('Set-Cookie', `oauth_pkce=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  headers.append('Set-Cookie', `oauth_return_to=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  return headers;
}
