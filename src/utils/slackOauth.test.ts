import { describe, it, expect, vi } from 'vitest';
import { exchangeSlackOAuthCode } from './slackOauth';

describe('exchangeSlackOAuthCode', () => {
  const baseParams = () => ({
    code: 'auth-code-123',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    redirectUri: 'https://example.com/auth/v1/callback',
    fetchImpl: vi.fn(),
  });

  it('成功時はteam/bot情報とアクセストークンを返す', async () => {
    const params = baseParams();
    params.fetchImpl = vi.fn().mockResolvedValue({
      json: async () => ({
        ok: true,
        access_token: 'xoxb-abc',
        scope: 'chat:write,app_mentions:read',
        bot_user_id: 'U_BOT',
        team: { id: 'T123', name: 'My Team' },
        authed_user: { id: 'U_INSTALLER' },
      }),
    });

    const result = await exchangeSlackOAuthCode(params);
    expect(result).toEqual({
      ok: true,
      teamId: 'T123',
      teamName: 'My Team',
      botUserId: 'U_BOT',
      accessToken: 'xoxb-abc',
      scope: 'chat:write,app_mentions:read',
      authedUserId: 'U_INSTALLER',
    });
  });

  it('client_id/client_secret/redirect_uriを正しいエンドポイントにPOSTする', async () => {
    const params = baseParams();
    params.fetchImpl = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, access_token: 'xoxb-abc', team: { id: 'T1' } }),
    });
    await exchangeSlackOAuthCode(params);

    const [url, init] = params.fetchImpl.mock.calls[0];
    expect(url).toBe('https://slack.com/api/oauth.v2.access');
    expect(init.method).toBe('POST');
    const body = new URLSearchParams(init.body);
    expect(body.get('code')).toBe('auth-code-123');
    expect(body.get('client_id')).toBe('client-id');
    expect(body.get('client_secret')).toBe('client-secret');
    expect(body.get('redirect_uri')).toBe('https://example.com/auth/v1/callback');
  });

  it('Slackがok:falseを返した場合はエラー内容を返す（握りつぶさない）', async () => {
    const params = baseParams();
    params.fetchImpl = vi.fn().mockResolvedValue({
      json: async () => ({ ok: false, error: 'invalid_code' }),
    });
    const result = await exchangeSlackOAuthCode(params);
    expect(result).toEqual({ ok: false, error: 'invalid_code' });
  });

  it('fetch自体が例外を投げた場合もエラー内容を返す', async () => {
    const params = baseParams();
    params.fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await exchangeSlackOAuthCode(params);
    expect(result).toEqual({ ok: false, error: 'network down' });
  });

  it('access_tokenが欠落している場合はエラーを返す', async () => {
    const params = baseParams();
    params.fetchImpl = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, team: { id: 'T1' } }),
    });
    const result = await exchangeSlackOAuthCode(params);
    expect(result.ok).toBe(false);
  });

  it('team.idが欠落している場合はエラーを返す', async () => {
    const params = baseParams();
    params.fetchImpl = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, access_token: 'xoxb-abc' }),
    });
    const result = await exchangeSlackOAuthCode(params);
    expect(result.ok).toBe(false);
  });

  it('team_name/bot_user_id/scope/authed_userが無い場合はnullで埋める', async () => {
    const params = baseParams();
    params.fetchImpl = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, access_token: 'xoxb-abc', team: { id: 'T1' } }),
    });
    const result = await exchangeSlackOAuthCode(params);
    expect(result).toEqual({
      ok: true,
      teamId: 'T1',
      teamName: null,
      botUserId: null,
      accessToken: 'xoxb-abc',
      scope: null,
      authedUserId: null,
    });
  });
});
