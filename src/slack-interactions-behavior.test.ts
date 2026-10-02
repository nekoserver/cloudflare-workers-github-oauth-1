/**
 * POST /slack/interactionsの実際のHTTPレスポンスを検証する振る舞いテスト。
 *
 * 旧: slack-interactions-route.test.ts はsrc/index.tsのソースコードを文字列として
 * 読み込みtoContainするだけで、実際にリクエストを送ったときの挙動(署名検証NG時に
 * 本当に401が返るか等)は一切確認していなかった。ここでは実際に正しい/不正な
 * Slack署名を作ってapp.request()で送り、レスポンスを検証する。
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import app from './index';

const SIGNING_SECRET = 'test-signing-secret';

async function signSlackRequest(rawBody: string, timestamp: string, signingSecret: string): Promise<string> {
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /slack/interactions', () => {
  it('署名が不正な場合は本文なしで401を返す', async () => {
    const rawBody = 'payload=%7B%7D';
    const timestamp = nowTimestamp();
    const res = await app.request(
      '/slack/interactions',
      {
        method: 'POST',
        headers: {
          'X-Slack-Request-Timestamp': timestamp,
          'X-Slack-Signature': 'v0=0000invalid',
        },
        body: rawBody,
      },
      { SLACK_SIGNING_SECRET: SIGNING_SECRET }
    );
    expect(res.status).toBe(401);
    expect(await res.text()).toBe('');
  });

  it('署名ヘッダが無い場合も401を返す', async () => {
    const res = await app.request(
      '/slack/interactions',
      { method: 'POST', body: 'payload=%7B%7D' },
      { SLACK_SIGNING_SECRET: SIGNING_SECRET }
    );
    expect(res.status).toBe(401);
  });

  it('署名が正しく、payloadが対象外のtype(view_submission等)の場合は200を返す(本文なしでスキップ)', async () => {
    const payload = JSON.stringify({ type: 'view_submission' });
    const rawBody = `payload=${encodeURIComponent(payload)}`;
    const timestamp = nowTimestamp();
    const signature = await signSlackRequest(rawBody, timestamp, SIGNING_SECRET);
    const res = await app.request(
      '/slack/interactions',
      {
        method: 'POST',
        headers: {
          'X-Slack-Request-Timestamp': timestamp,
          'X-Slack-Signature': signature,
        },
        body: rawBody,
      },
      { SLACK_SIGNING_SECRET: SIGNING_SECRET }
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });

  it('署名が正しく、message_actionでask_aiコールバックかつ必要フィールドが揃っていれば200を返す(AI返信タスクはバックグラウンドで試行され、レスポンス自体はブロックしない)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
    const payload = JSON.stringify({
      type: 'message_action',
      callback_id: 'ask_ai',
      message: { text: '質問です', ts: '123.456' },
      channel: { id: 'C123' },
      team: { id: 'T123' },
    });
    const rawBody = `payload=${encodeURIComponent(payload)}`;
    const timestamp = nowTimestamp();
    const signature = await signSlackRequest(rawBody, timestamp, SIGNING_SECRET);
    const res = await app.request(
      '/slack/interactions',
      {
        method: 'POST',
        headers: {
          'X-Slack-Request-Timestamp': timestamp,
          'X-Slack-Signature': signature,
        },
        body: rawBody,
      },
      { SLACK_SIGNING_SECRET: SIGNING_SECRET }
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });

  it('message_actionでも必要フィールド(text/channel/ts)が欠けていれば200を返す(スキップ、エラーにはしない)', async () => {
    const payload = JSON.stringify({
      type: 'message_action',
      callback_id: 'ask_ai',
      message: {},
      channel: {},
    });
    const rawBody = `payload=${encodeURIComponent(payload)}`;
    const timestamp = nowTimestamp();
    const signature = await signSlackRequest(rawBody, timestamp, SIGNING_SECRET);
    const res = await app.request(
      '/slack/interactions',
      {
        method: 'POST',
        headers: {
          'X-Slack-Request-Timestamp': timestamp,
          'X-Slack-Signature': signature,
        },
        body: rawBody,
      },
      { SLACK_SIGNING_SECRET: SIGNING_SECRET }
    );
    expect(res.status).toBe(200);
  });
});
