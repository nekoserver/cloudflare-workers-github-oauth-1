/**
 * POST /api/tsubuyakiの実際のHTTPレスポンスを検証する振る舞いテスト。
 *
 * 背景: notification_settings.slack_enabled(デフォルトOFF)は、ログイン失敗・
 * PR要約・cf-auth通知等の「自動で飛ぶ通知」をユーザーが黙らせるためのオプトアウト
 * であり、ユーザーが明示的にボタンを押して投稿するこの操作とは無関係だった。
 * 以前はresolveNotifyConfigWithSetting経由でこのフラグを参照してしまっており、
 * SLACK_OAUTH_TOKEN/SLACK_CHANNEL_IDをsecretで設定済みでもslack_enabledが0の
 * ままだと「Slack連携が設定されていません」という誤解を招くエラーで投稿できな
 * かった(実際にはsecretの問題ではなくD1のユーザーオプションの問題)。
 * resolveNotifyConfig(フラグを参照しない版)に切り替え、slack_enabledの値に
 * 関わらずsecretが揃っていれば投稿できるようにした。
 *
 * ここでは実際にapp.request()でリクエストを送り、D1のslack_enabled値に
 * 関わらず投稿が成功すること・secret自体が無い場合は503になることを検証する。
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader(sub = 'test-user') {
  const token = await createJWT({ sub, name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function createMockDb(options: { slackEnabled: number | null }) {
  const makeResult = (sql: string) => ({
    first: async () => {
      if (sql.includes('user_sessions')) return { revoked_at: null, last_activity_at: null };
      if (sql.includes('notification_settings')) {
        return options.slackEnabled === null ? null : { slack_enabled: options.slackEnabled };
      }
      return null;
    },
    run: async () => ({ success: true }),
  });
  const db = {
    prepare: (sql: string) => ({
      ...makeResult(sql),
      bind: (..._params: unknown[]) => makeResult(sql),
    }),
  };
  return db;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/tsubuyaki: notification_settings.slack_enabledとは無関係に投稿できる', () => {
  it('D1のslack_enabledが0でも、SLACK_OAUTH_TOKEN/SLACK_CHANNEL_IDが設定済みなら実際にSlack APIを呼び200を返す', async () => {
    const db = createMockDb({ slackEnabled: 0 });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/tsubuyaki',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'こんにちは' }),
      },
      { JWT_SECRET, DB: db, SLACK_OAUTH_TOKEN: 'xoxb-dummy', SLACK_CHANNEL_ID: 'C123' }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('notification_settingsテーブルに行が無い場合(マイグレーション未実行等)でも同じく投稿できる', async () => {
    const db = createMockDb({ slackEnabled: null });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/tsubuyaki',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'こんにちは' }),
      },
      { JWT_SECRET, DB: db, SLACK_OAUTH_TOKEN: 'xoxb-dummy', SLACK_CHANNEL_ID: 'C123' }
    );
    expect(res.status).toBe(200);
  });

  it('D1のslack_enabledが1でSLACK_OAUTH_TOKEN/SLACK_CHANNEL_IDも設定済みなら、実際にSlack APIを呼び200を返す', async () => {
    const db = createMockDb({ slackEnabled: 1 });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/tsubuyaki',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'こんにちは' }),
      },
      { JWT_SECRET, DB: db, SLACK_OAUTH_TOKEN: 'xoxb-dummy', SLACK_CHANNEL_ID: 'C123' }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('SLACK_OAUTH_TOKEN自体が未設定なら、slack_enabledの値に関わらず503エラーを返す(こちらは本当にsecret側の問題)', async () => {
    const db = createMockDb({ slackEnabled: 1 });
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/tsubuyaki',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'こんにちは' }),
      },
      { JWT_SECRET, DB: db, SLACK_CHANNEL_ID: 'C123' }
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.error).toBe('Slack連携が設定されていません（SLACK_OAUTH_TOKEN / SLACK_CHANNEL_ID が未設定）');
  });
});
