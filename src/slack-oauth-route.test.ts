/**
 * GET /auth/slack/install・GET /auth/v1/callbackの実際のHTTPレスポンスを検証する
 * 振る舞いテスト。旧版はソーステキスト照合のみで、実際にリクエストを送った際の
 * ステータス・Set-Cookie・Locationヘッダーは一切検証していなかった。
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader(sub = 'test-user') {
  const token = await createJWT({ sub, name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function makeDb() {
  const inserts: unknown[][] = [];
  return {
    db: {
      prepare: (_sql: string) => ({
        bind: (...args: unknown[]) => ({
          run: async () => {
            inserts.push(args);
            return { success: true };
          },
          first: async () => null,
        }),
      }),
    },
    inserts,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /auth/slack/install', () => {
  it('未ログインの場合は200(インストール開始)にならない(authMiddlewareで保護されている)', async () => {
    const res = await app.request('/auth/slack/install', {}, { JWT_SECRET, SLACK_CLIENT_ID: 'client1' });
    expect(res.status).not.toBe(302);
  });

  it('SLACK_CLIENT_IDが未設定なら500を返す', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request('/auth/slack/install', { headers: { Authorization: authHeader } }, { JWT_SECRET });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Slack OAuth is not configured' });
  });

  it('設定済みなら302でSlack認可画面へリダイレクトし、HttpOnlyのstateクッキーを発行する', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/auth/slack/install',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, SLACK_CLIENT_ID: 'client1' }
    );
    expect(res.status).toBe(302);
    const location = res.headers.get('Location');
    expect(location).toContain('https://slack.com/oauth/v2/authorize');
    expect(location).toContain('client_id=client1');
    expect(location).toContain(encodeURIComponent('/auth/v1/callback'));
    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toContain('slack_oauth_state=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
  });
});

describe('GET /auth/v1/callback', () => {
  it('codeが無い場合は400を返す', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request('/auth/v1/callback', { headers: { Authorization: authHeader } }, { JWT_SECRET });
    expect(res.status).toBe(400);
  });

  it('stateがクッキーの値と一致しない場合は400を返す(CSRF対策)', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/auth/v1/callback?code=abc&state=wrong',
      { headers: { Authorization: authHeader, Cookie: 'slack_oauth_state=correct' } },
      { JWT_SECRET }
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Invalid state parameter');
  });

  it('state一致・clientId/secret設定済みだがコード交換が失敗した場合は502でstateクッキーを削除する', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'invalid_code' }), { status: 200 })));
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/auth/v1/callback?code=abc&state=correct',
      { headers: { Authorization: authHeader, Cookie: 'slack_oauth_state=correct' } },
      { JWT_SECRET, SLACK_CLIENT_ID: 'client1', SLACK_CLIENT_SECRET: 'secret1' }
    );
    expect(res.status).toBe(502);
    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toContain('slack_oauth_state=;');
    expect(setCookie).toContain('Max-Age=0');
  });

  it('コード交換が成功した場合は302で/settingsへリダイレクトし、slack_installationsへ記録を試みる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ ok: true, access_token: 'xoxb-123', team: { id: 'T1', name: 'Team1' }, authed_user: { id: 'U1' } }),
          { status: 200 }
        )
      )
    );
    const { db, inserts } = makeDb();
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/auth/v1/callback?code=abc&state=correct',
      { headers: { Authorization: authHeader, Cookie: 'slack_oauth_state=correct' } },
      { JWT_SECRET, SLACK_CLIENT_ID: 'client1', SLACK_CLIENT_SECRET: 'secret1', DB: db as never }
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/settings?slack=connected');
    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toContain('slack_oauth_state=;');
    expect(inserts.length).toBeGreaterThan(0);
  });
});
