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
