/**
 * POST /slack/eventの実際のHTTPレスポンスを検証する振る舞いテスト。
 * dispatchSlackAiReplyはindex.ts内のローカル関数でモジュール外へexportされて
 * いないため、直接呼び出すユニットテストはできない。代わりにapp_mentionイベントを
 * 送った際にレスポンス自体(200・本文なし)が壊れないことまでをapp.request()で検証する
 * (waitUntilでの非同期後続処理はテスト環境のexecutionCtx制約により実行されない)。
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

describe('POST /slack/event', () => {
  it('SLACK_SIGNING_SECRET未設定の場合は本文なしで401を返す', async () => {
    const res = await app.request('/slack/event', { method: 'POST', body: '{}' }, {});
    expect(res.status).toBe(401);
    expect(await res.text()).toBe('');
  });

  it('署名が不正な場合は本文なしで401を返す', async () => {
    const res = await app.request(
      '/slack/event',
      {
        method: 'POST',
        headers: { 'X-Slack-Request-Timestamp': nowTimestamp(), 'X-Slack-Signature': 'v0=invalid' },
        body: '{}',
      },
      { SLACK_SIGNING_SECRET: SIGNING_SECRET }
    );
    expect(res.status).toBe(401);
  });

  it('署名が正しいが本文が不正なJSONの場合は本文なしで400を返す', async () => {
    const rawBody = '{not-json';
    const timestamp = nowTimestamp();
    const signature = await signSlackRequest(rawBody, timestamp, SIGNING_SECRET);
    const res = await app.request(
      '/slack/event',
      {
        method: 'POST',
        headers: { 'X-Slack-Request-Timestamp': timestamp, 'X-Slack-Signature': signature },
        body: rawBody,
      },
      { SLACK_SIGNING_SECRET: SIGNING_SECRET }
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toBe('');
  });

  it('url_verificationのchallengeをそのままJSONで返す(Slack App登録時のURL検証)', async () => {
    const rawBody = JSON.stringify({ type: 'url_verification', challenge: 'abc123' });
    const timestamp = nowTimestamp();
    const signature = await signSlackRequest(rawBody, timestamp, SIGNING_SECRET);
    const res = await app.request(
      '/slack/event',
      {
        method: 'POST',
        headers: { 'X-Slack-Request-Timestamp': timestamp, 'X-Slack-Signature': signature },
        body: rawBody,
      },
      { SLACK_SIGNING_SECRET: SIGNING_SECRET }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ challenge: 'abc123' });
  });

  it('app_mentionイベント(自App自身の発言ではない)を受けても本文なしで200を返す(即時ACK、実処理はバックグラウンド)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
    const rawBody = JSON.stringify({
      type: 'event_callback',
      team_id: 'T1',
      event: { type: 'app_mention', user: 'U_OTHER', text: '<@BOT> 質問です', channel: 'C1', ts: '123.456' },
    });
    const timestamp = nowTimestamp();
    const signature = await signSlackRequest(rawBody, timestamp, SIGNING_SECRET);
    const res = await app.request(
      '/slack/event',
      {
        method: 'POST',
        headers: { 'X-Slack-Request-Timestamp': timestamp, 'X-Slack-Signature': signature },
        body: rawBody,
      },
      { SLACK_SIGNING_SECRET: SIGNING_SECRET }
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });

  it('bot_id付きのapp_mention(SLACK_BOT_USER_ID未設定時は自App自身とみなして除外)でも本文なしで200を返す', async () => {
    const rawBody = JSON.stringify({
      type: 'event_callback',
      team_id: 'T1',
      event: { type: 'app_mention', bot_id: 'B1', text: 'hi', channel: 'C1', ts: '123.456' },
    });
    const timestamp = nowTimestamp();
    const signature = await signSlackRequest(rawBody, timestamp, SIGNING_SECRET);
    const res = await app.request(
      '/slack/event',
      {
        method: 'POST',
        headers: { 'X-Slack-Request-Timestamp': timestamp, 'X-Slack-Signature': signature },
        body: rawBody,
      },
      { SLACK_SIGNING_SECRET: SIGNING_SECRET }
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });

  it('app_mention以外のイベント種別でも本文なしで200を返す(確認応答のみ)', async () => {
    const rawBody = JSON.stringify({
      type: 'event_callback',
      team_id: 'T1',
      event: { type: 'message', text: 'hi', channel: 'C1', ts: '123.456' },
    });
    const timestamp = nowTimestamp();
    const signature = await signSlackRequest(rawBody, timestamp, SIGNING_SECRET);
    const res = await app.request(
      '/slack/event',
      {
        method: 'POST',
        headers: { 'X-Slack-Request-Timestamp': timestamp, 'X-Slack-Signature': signature },
        body: rawBody,
      },
      { SLACK_SIGNING_SECRET: SIGNING_SECRET }
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });
});
