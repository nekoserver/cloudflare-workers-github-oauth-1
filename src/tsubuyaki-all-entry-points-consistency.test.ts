/**
 * 「つぶやき投稿」の3つの入口(POST /api/tsubuyaki・POST /api/tsubuyaki-external・
 * Slackスラッシュコマンド /pts)が、notification_settings.slack_enabledの値
 * (OFF/未設定含む)に関わらず一貫して投稿に成功することを、1ファイルで
 * まとめて検証する。
 *
 * 背景: 当初 POST /api/tsubuyaki だけをslack_enabled非依存に修正したが、
 * 同じ理由で無関係なはずの/pts(Slackスラッシュコマンド)を直し忘れており、
 * ユーザーから実際に不具合報告を受けるまで発覚しなかった(2026-10-02)。
 * 3つの入口は内部的にほぼ同じ投稿ロジック(buildFreeTextSlackMessage等)を
 * 共有しているにもかかわらず、各テストファイルが入口ごとに分かれていたため、
 * 「一部の入口だけ直し忘れる」という回帰を機械的に検出できなかった。
 * このファイルは3入口を同一のアサーション(slack_enabled=0でも200になる)で
 * 並べて検証することで、今後いずれか1つだけ修正を忘れた場合に必ず失敗する
 * ようにする。
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'test-secret';
const SLACK_SIGNING_SECRET = 'test-signing-secret';
const AICHAT_EXTERNAL_SECRET = 'test-aichat-external-secret';
const AICHAT_USER_TOKEN_SECRET = 'test-user-token-secret';

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

/** notification_settings.slack_enabled=0(OFF)を返すD1モック(共通) */
function makeSlackDisabledDb(extra?: { allowedEmail?: string; githubLogin?: string }) {
  return {
    prepare: (sql: string) => ({
      first: async () => {
        if (sql.includes('notification_settings')) return { slack_enabled: 0 };
        if (sql.includes('dynamicneko_aichat_allowed_users') && extra?.allowedEmail) {
          return { github_login: extra.githubLogin ?? null };
        }
        if (sql.includes('user_sessions')) return { revoked_at: null, last_activity_at: null };
        return null;
      },
      bind: (..._params: unknown[]) => ({
        first: async () => {
          if (sql.includes('notification_settings')) return { slack_enabled: 0 };
          if (sql.includes('dynamicneko_aichat_allowed_users') && extra?.allowedEmail) {
            return { github_login: extra.githubLogin ?? null };
          }
          if (sql.includes('user_sessions')) return { revoked_at: null, last_activity_at: null };
          return null;
        },
      }),
      run: async () => ({ success: true }),
    }),
  };
}

function makeUserToken(email: string): Promise<string> {
  return createJWT({ sub: email }, AICHAT_USER_TOKEN_SECRET, 60);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('つぶやき投稿の3入口: notification_settings.slack_enabled=0でもすべて投稿が成功する', () => {
  it('POST /api/tsubuyaki は slack_enabled=0 でも200を返す', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/tsubuyaki',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'こんにちは' }),
      },
      { JWT_SECRET, DB: makeSlackDisabledDb(), SLACK_OAUTH_TOKEN: 'xoxb-dummy', SLACK_CHANNEL_ID: 'C123' }
    );
    expect(res.status).toBe(200);
  });

  it('POST /api/tsubuyaki-external は slack_enabled=0 でも200を返す', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
    const token = await makeUserToken('octocat@example.com');
    const res = await app.request(
      '/api/tsubuyaki-external',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${AICHAT_EXTERNAL_SECRET}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userToken: token, text: 'こんにちは' }),
      },
      {
        AICHAT_EXTERNAL_SECRET,
        AICHAT_USER_TOKEN_SECRET,
        DB: makeSlackDisabledDb({ allowedEmail: 'octocat@example.com', githubLogin: 'octocat' }),
        SLACK_OAUTH_TOKEN: 'xoxb-dummy',
        SLACK_CHANNEL_ID: 'C123',
      }
    );
    expect(res.status).toBe(200);
  });

  it('Slackスラッシュコマンド /pts は slack_enabled=0 でも200(投稿成功メッセージ)を返す', async () => {
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
      { SLACK_SIGNING_SECRET, SLACK_OAUTH_TOKEN: 'xoxb-dummy', SLACK_CHANNEL_ID: 'C123', DB: makeSlackDisabledDb() as never }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { text: string };
    expect(body.text).toBe('✅ Slackに投稿しました');
  });
});
