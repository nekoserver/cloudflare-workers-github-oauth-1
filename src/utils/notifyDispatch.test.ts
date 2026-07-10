import { describe, it, expect, vi } from 'vitest';
import {
  resolveNotifyTarget,
  resolveNotifyConfig,
  isNotifyConfigured,
  sendNotification,
} from './notifyDispatch';

describe('resolveNotifyTarget', () => {
  it('NOTIFY_TARGET が未設定なら既存の挙動を保つため slack を返す', () => {
    expect(resolveNotifyTarget({})).toBe('slack');
  });

  it('NOTIFY_TARGET が worker なら worker を返す', () => {
    expect(resolveNotifyTarget({ NOTIFY_TARGET: 'worker' })).toBe('worker');
  });

  it('NOTIFY_TARGET が想定外の値なら slack にフォールバックする', () => {
    expect(resolveNotifyTarget({ NOTIFY_TARGET: 'typo' })).toBe('slack');
  });
});

describe('resolveNotifyConfig', () => {
  it('環境変数からslack設定とworker設定の両方を読み取る', () => {
    const config = resolveNotifyConfig({
      NOTIFY_TARGET: 'worker',
      SLACK_OAUTH_TOKEN: 'xoxb-token',
      SLACK_CHANNEL_ID: 'C123',
      NOTIFY_WORKER_URL: 'https://notify.example.workers.dev/ingest',
      NOTIFY_WORKER_SECRET: 'shh',
    });
    expect(config).toEqual({
      target: 'worker',
      slackToken: 'xoxb-token',
      slackChannel: 'C123',
      workerUrl: 'https://notify.example.workers.dev/ingest',
      workerSecret: 'shh',
    });
  });
});

describe('isNotifyConfigured', () => {
  it('target=slack は token と channel の両方が必要', () => {
    expect(isNotifyConfigured({ target: 'slack' })).toBe(false);
    expect(isNotifyConfigured({ target: 'slack', slackToken: 't' })).toBe(false);
    expect(isNotifyConfigured({ target: 'slack', slackToken: 't', slackChannel: 'c' })).toBe(true);
  });

  it('target=worker は workerUrl だけで足りる（secretは任意）', () => {
    expect(isNotifyConfigured({ target: 'worker' })).toBe(false);
    expect(isNotifyConfigured({ target: 'worker', workerUrl: 'https://example.com' })).toBe(true);
  });

  it('target=slack かつ enabled=false(ユーザーオプションOFF)なら設定が揃っていても送らない', () => {
    expect(isNotifyConfigured({ target: 'slack', slackToken: 't', slackChannel: 'c', enabled: false })).toBe(false);
  });

  it('target=worker はenabled=falseの影響を受けない(Slack専用オプションのため)', () => {
    expect(isNotifyConfigured({ target: 'worker', workerUrl: 'https://example.com', enabled: false })).toBe(true);
  });

  it('enabledを指定しない場合は既存どおり動作する(後方互換)', () => {
    expect(isNotifyConfigured({ target: 'slack', slackToken: 't', slackChannel: 'c' })).toBe(true);
  });
});

describe('sendNotification', () => {
  it('未設定の場合は実際に送信せず、どちらの送信先が未設定かを説明するエラーを返す', async () => {
    const postSlackMessage = vi.fn();
    const fetchImpl = vi.fn();
    const result = await sendNotification({ target: 'slack' }, { text: 'hi' }, { postSlackMessage, fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('SLACK_OAUTH_TOKEN');
    expect(postSlackMessage).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('target=worker が未設定の場合はNOTIFY_WORKER_URLについて説明する', async () => {
    const postSlackMessage = vi.fn();
    const fetchImpl = vi.fn();
    const result = await sendNotification({ target: 'worker' }, { text: 'hi' }, { postSlackMessage, fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('NOTIFY_WORKER_URL');
  });

  it('target=slack のときは postSlackMessage を呼ぶ（外部Workerへは送らない）', async () => {
    const postSlackMessage = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const fetchImpl = vi.fn();
    const config = { target: 'slack' as const, slackToken: 'xoxb-token', slackChannel: 'C123' };
    const result = await sendNotification(config, { text: 'hello', blocks: [{ type: 'section' }], thread_ts: '123.456' }, { postSlackMessage, fetchImpl });
    expect(postSlackMessage).toHaveBeenCalledWith({
      token: 'xoxb-token',
      channel: 'C123',
      text: 'hello',
      blocks: [{ type: 'section' }],
      thread_ts: '123.456',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it('target=worker のときはNOTIFY_WORKER_URLへPOSTする（Slackへは送らない）', async () => {
    const postSlackMessage = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue({ status: 200, text: async () => '' });
    const config = { target: 'worker' as const, workerUrl: 'https://notify.example.workers.dev/ingest', workerSecret: 'shh', slackChannel: 'C123' };
    const result = await sendNotification(config, { text: 'hello' }, { postSlackMessage, fetchImpl });

    expect(postSlackMessage).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://notify.example.workers.dev/ingest');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer shh');
    const body = JSON.parse(init.body);
    expect(body).toEqual({ channel: 'C123', text: 'hello', blocks: undefined, thread_ts: undefined, source: 'cloudflare-workers-github-oauth-1' });
    expect(result.ok).toBe(true);
  });

  it('worker宛の送信でsecret未設定ならAuthorizationヘッダを付けない', async () => {
    const postSlackMessage = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue({ status: 200, text: async () => '' });
    const config = { target: 'worker' as const, workerUrl: 'https://notify.example.workers.dev/ingest' };
    await sendNotification(config, { text: 'hello' }, { postSlackMessage, fetchImpl });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('workerからのHTTPエラー応答は握りつぶさずエラー内容を返す', async () => {
    const postSlackMessage = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue({ status: 500, text: async () => 'internal error' });
    const config = { target: 'worker' as const, workerUrl: 'https://notify.example.workers.dev/ingest' };
    const result = await sendNotification(config, { text: 'hello' }, { postSlackMessage, fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toContain('internal error');
  });

  it('workerへのfetchが例外を投げた場合も握りつぶさずエラーを返す', async () => {
    const postSlackMessage = vi.fn();
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const config = { target: 'worker' as const, workerUrl: 'https://notify.example.workers.dev/ingest' };
    const result = await sendNotification(config, { text: 'hello' }, { postSlackMessage, fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('network down');
  });
});
