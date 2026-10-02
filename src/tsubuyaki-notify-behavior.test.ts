/**
 * POST /api/tsubuyakiの実際のHTTPレスポンスを検証する振る舞いテスト。
 *
 * 背景: tsubuyaki-route.test.ts(既存)はsrc/index.tsのソースコードを文字列として
 * 読み込み、特定の文字列が含まれているかだけを検証する(readFileSync + toContain)。
 * これは「そのコードが存在する」ことしか保証せず、実際にリクエストを投げた際の
 * レスポンス(ステータスコード・ボディ)は一切検証していない。
 *
 * この構造には実際に穴があった: SLACK_OAUTH_TOKEN/SLACK_CHANNEL_IDをsecretで
 * 設定していても、D1のnotification_settings.slack_enabled(デフォルトOFF、
 * resolveNotifyConfigWithSetting経由)が0のままだと、/api/tsubuyakiは
 * 「Slack連携が設定されていません」という誤解を招くエラーを返す
 * (実際にはsecretの問題ではなくD1のユーザーオプションの問題)。
 * ソーステキスト検証ではこの実際の分岐結果(503になる・エラー文言)を一切
 * 検証できないため、この挙動が壊れても検出できなかった。
 *
 * ここでは実際にapp.request()でリクエストを送り、D1のslack_enabled値の
 * 組み合わせごとに実際のレスポンスを検証する。
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

describe('POST /api/tsubuyaki: notification_settings.slack_enabledによる実際の分岐結果', () => {
  it('SLACK_OAUTH_TOKEN/SLACK_CHANNEL_IDを設定していても、D1のslack_enabledが0なら503とSlack未設定エラーを返す(secretの問題ではない)', async () => {
    const db = createMockDb({ slackEnabled: 0 });
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
    expect(res.status).toBe(503);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Slack連携が設定されていません（SLACK_OAUTH_TOKEN / SLACK_CHANNEL_ID が未設定）');
  });

  it('notification_settingsテーブルに行が無い場合(マイグレーション未実行等)もデフォルトOFFとして同じ503を返す', async () => {
    const db = createMockDb({ slackEnabled: null });
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
    expect(res.status).toBe(503);
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

  it('D1のslack_enabledが1でも、SLACK_OAUTH_TOKEN自体が未設定なら同じ503エラーを返す(こちらは本当にsecret側の問題)', async () => {
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
