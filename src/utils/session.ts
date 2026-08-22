import { createJWT, type JWTPayload } from './jwt';
import { resolveIdleTimeoutSeconds } from '../types';

export function getSessionDurationSeconds(duration: string): number {
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

const VALID_SESSION_DURATIONS = ['1h', '3h', '8h', '1d', '3d', '1w'];

export function resolveSessionDuration(
  dbValue: string | null | undefined,
  cookieValue: string | null | undefined
): string {
  if (dbValue && VALID_SESSION_DURATIONS.includes(dbValue)) return dbValue;
  if (cookieValue && VALID_SESSION_DURATIONS.includes(cookieValue)) return cookieValue;
  return '1h';
}

/**
 * heritage-journeyの「巡回ルートを再現する」実行時に国別フィルタ(ドロップダウンで
 * グレーアウトされた国の地点)を実際のツアーデータから除外するかどうかを、
 * D1優先→Cookie→ハードコードデフォルト(する=true)の順で解決する。
 */
export function resolveHeritageTourCountryFilterEnabled(
  dbValue: string | null | undefined,
  cookieValue: string | null | undefined
): boolean {
  if (dbValue === 'on') return true;
  if (dbValue === 'off') return false;
  if (cookieValue === 'on') return true;
  if (cookieValue === 'off') return false;
  return true;
}

export type RenewSessionParams = {
  currentUser: JWTPayload;
  newDuration: string;
  jwtSecret: string;
  idleTimeoutEnv: string | undefined;
};

export type RenewSessionResult = {
  token: string;
  sessionDurationSeconds: number;
  idleTimeoutSeconds: number;
  cookies: string[];
};

export async function renewSession(params: RenewSessionParams): Promise<RenewSessionResult> {
  const { currentUser, newDuration, jwtSecret, idleTimeoutEnv } = params;
  const sessionDurationSeconds = getSessionDurationSeconds(newDuration);
  const idleTimeoutSeconds = resolveIdleTimeoutSeconds(
    idleTimeoutEnv,
    sessionDurationSeconds,
    sessionDurationSeconds
  );

  const token = await createJWT(
    {
      sub: currentUser.sub,
      name: currentUser.name,
      email: currentUser.email,
      github_id: currentUser.github_id,
      github_access_token: currentUser.github_access_token,
    },
    jwtSecret,
    sessionDurationSeconds
  );

  const cookies = [
    `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${sessionDurationSeconds}`,
    `login_timestamp=${Date.now()}; Path=/; Secure; SameSite=Lax; Max-Age=${sessionDurationSeconds}`,
    `last_activity=${Date.now()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${idleTimeoutSeconds}`,
    `user_session_duration=${newDuration}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`,
  ];

  return { token, sessionDurationSeconds, idleTimeoutSeconds, cookies };
}
