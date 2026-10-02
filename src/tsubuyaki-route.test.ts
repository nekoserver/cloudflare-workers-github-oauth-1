/**
 * GET /tsubuyaki・POST /slack/commandsの実際のHTTPレスポンスを検証する振る舞いテスト。
 * (POST /api/tsubuyakiの通知分岐はtsubuyaki-notify-behavior.test.tsで実動作テスト済み)
 *
 * 旧版はsrc/index.tsをソーステキストとして読み、特定の文字列が含まれるかだけを
 * 検証していた(実際にリクエストを送ったときの挙動は未検証)。
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'test-secret';
const SLACK_SIGNING_SECRET = 'test-signing-secret';

async function makeAuthHeader(sub = 'test-user') {
  const token = await createJWT({ sub, name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

async function signSlackForm(rawBody: string, timestamp: string, signingSecret: string): Promise<string> {
  const sigBasestring = `v0:${timestamp}:${rawBody}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(sigBasestring));
  return 'v0=' + Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function nowTimestamp(): string {
  return String(Math.floor(Date.now() / 1000));
}

function makeEnabledDb() {
  return {
    prepare: (_sql: string) => ({
      first: async () => ({ slack_enabled: 1 }),
      bind: (..._params: unknown[]) => ({ first: async () => ({ slack_enabled: 1 }) }),
    }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /tsubuyaki', () => {
  it('未ログインの場合はログインページへリダイレクトされる(authMiddlewareで保護されている)', async () => {
    const res = await app.request('/tsubuyaki', {}, { JWT_SECRET });
    expect(res.status).not.toBe(200);
  });

  it('ログイン済みの場合は200でHTMLを返す', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request('/tsubuyaki', { headers: { Authorization: authHeader } }, { JWT_SECRET });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });
});

describe('POST /slack/commands', () => {
  it('未対応のコマンドにはephemeralで案内メッセージを200で返す', async () => {
    const res = await app.request(
      '/slack/commands',
      { method: 'POST', body: 'command=%2Funknown' },
      {}
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { response_type: string; text: string };
    expect(body.response_type).toBe('ephemeral');
    expect(body.text).toContain('未対応のコマンドです');
  });

  it('/pts コマンドで署名が不正な場合は401を返す', async () => {
    const rawBody = 'command=%2Fpts&text=&user_name=tester';
    const res = await app.request(
      '/slack/commands',
      {
        method: 'POST',
        headers: { 'X-Slack-Request-Timestamp': nowTimestamp(), 'X-Slack-Signature': 'v0=invalid' },
        body: rawBody,
      },
      { SLACK_SIGNING_SECRET }
    );
    expect(res.status).toBe(401);
  });

  it('/pts コマンド(text=f1以外)は投稿が成功すればephemeralで成功メッセージを返す', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
    const rawBody = 'command=%2Fpts&text=こんにちは&user_name=tester';
    const timestamp = nowTimestamp();
    const signature = await signSlackForm(rawBody, timestamp, SLACK_SIGNING_SECRET);
    const res = await app.request(
      '/slack/commands',
      {
        method: 'POST',
        headers: { 'X-Slack-Request-Timestamp': timestamp, 'X-Slack-Signature': signature },
        body: rawBody,
      },
      { SLACK_SIGNING_SECRET, SLACK_OAUTH_TOKEN: 'xoxb-dummy', SLACK_CHANNEL_ID: 'C123', DB: makeEnabledDb() as never }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { response_type: string; text: string };
    expect(body.text).toBe('✅ Slackに投稿しました');
  });

  it('/pts コマンド(text=f1以外)で通知先未設定の場合はephemeralで失敗メッセージを返す(握りつぶさない)', async () => {
    const rawBody = 'command=%2Fpts&text=こんにちは&user_name=tester';
    const timestamp = nowTimestamp();
    const signature = await signSlackForm(rawBody, timestamp, SLACK_SIGNING_SECRET);
    const res = await app.request(
      '/slack/commands',
      {
        method: 'POST',
        headers: { 'X-Slack-Request-Timestamp': timestamp, 'X-Slack-Signature': signature },
        body: rawBody,
      },
      { SLACK_SIGNING_SECRET }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { response_type: string; text: string };
    expect(body.text).toContain('❌');
    expect(body.text).toContain('投稿に失敗しました');
  });

  it('/pts f1 コマンドはF1スケジュール処理にディスパッチされ、署名が正しければ200を返す', async () => {
    const rawBody = 'command=%2Fpts&text=f1&user_name=tester';
    const timestamp = nowTimestamp();
    const signature = await signSlackForm(rawBody, timestamp, SLACK_SIGNING_SECRET);
    const res = await app.request(
      '/slack/commands',
      {
        method: 'POST',
        headers: { 'X-Slack-Request-Timestamp': timestamp, 'X-Slack-Signature': signature },
        body: rawBody,
      },
      { SLACK_SIGNING_SECRET }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { response_type: string };
    expect(body.response_type).toBe('ephemeral');
  });
});
