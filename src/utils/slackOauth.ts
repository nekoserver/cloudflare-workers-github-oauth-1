export type SlackOAuthExchangeResult =
  | {
      ok: true;
      teamId: string;
      teamName: string | null;
      botUserId: string | null;
      accessToken: string;
      scope: string | null;
      authedUserId: string | null;
    }
  | { ok: false; error: string };

export type SlackOAuthFetchFn = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string }
) => Promise<{ json: () => Promise<unknown> }>;

/**
 * Slack OAuth v2 の認可コードをアクセストークンに交換する（POST oauth.v2.access）。
 * Slack API は HTTP 200 でも `ok: false` を返すことがあるため、両方を確認する。
 */
export async function exchangeSlackOAuthCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl: SlackOAuthFetchFn;
}): Promise<SlackOAuthExchangeResult> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
  }).toString();

  let payload: unknown;
  try {
    const response = await params.fetchImpl('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    payload = await response.json();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Slack API request failed' };
  }

  const record = (typeof payload === 'object' && payload !== null) ? payload as Record<string, unknown> : {};
  if (record.ok !== true) {
    const errorDetail = typeof record.error === 'string' ? record.error : 'Slack API returned an error';
    return { ok: false, error: errorDetail };
  }

  const accessToken = typeof record.access_token === 'string' ? record.access_token : null;
  const team = (typeof record.team === 'object' && record.team !== null) ? record.team as Record<string, unknown> : {};
  const teamId = typeof team.id === 'string' ? team.id : null;
  const authedUser = (typeof record.authed_user === 'object' && record.authed_user !== null) ? record.authed_user as Record<string, unknown> : {};

  if (!accessToken || !teamId) {
    return { ok: false, error: 'Slack response missing access_token or team.id' };
  }

  return {
    ok: true,
    teamId,
    teamName: typeof team.name === 'string' ? team.name : null,
    botUserId: typeof record.bot_user_id === 'string' ? record.bot_user_id : null,
    accessToken,
    scope: typeof record.scope === 'string' ? record.scope : null,
    authedUserId: typeof authedUser.id === 'string' ? authedUser.id : null,
  };
}
