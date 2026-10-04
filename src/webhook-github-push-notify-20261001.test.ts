import { afterEach, describe, expect, it, vi } from 'vitest';
import app from './index';

// 対象: POST /webhook/github のpushイベント処理。
//
// 背景: /webhook/githubはpull_request・installation(_repositories)・
// repository(created)の3種類のイベントしか通知先(Slack/外部Worker=cf-auth)へ
// 転送しておらず、pushイベント(リポジトリwebhookの既定イベント)は
// webhook_logテーブルに記録されるだけで通知が一切飛ばなかった
// (rails-rootのpush webhookがcf-authに記録されないという報告で判明)。
// src/utils/githubPushNotify.tsのbuildPushNotificationText()を呼び、
// NOTIFY_TARGET=workerのときにdispatchNotification経由で外部Worker(cf-auth)の
// /ingestへ実際にfetchされることを、実リクエストで確認する。
//
// 故障シナリオ:
//   (1) pushイベントで通知(fetch)が一切発生しない(今回の不具合の再発)
//   (2) 通知先未設定でもエラーにならず処理自体は継続する(既存方針の維持)
//   (3) installation等repositoryを持たないイベントで例外を投げる(回帰無し確認)

const secret = 'test-github-webhook-secret';

async function signBody(body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256=${hex}`;
}

function noopDb() {
  return {
    prepare: () => ({
      bind: () => ({
        run: () => Promise.resolve({ success: true }),
        first: () => Promise.resolve(null),
        all: () => Promise.resolve({ results: [] }),
      }),
    }),
  };
}

async function postPushWebhook(body: string, env: Record<string, unknown>) {
  const signature = await signBody(body);
  return app.request(
    '/webhook/github',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
        'X-GitHub-Event': 'push',
        'X-GitHub-Delivery': 'delivery-push-test',
      },
      body,
    },
    env
  );
}

describe('POST /webhook/github: pushイベントで通知先(cf-auth)へ転送する', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('NOTIFY_TARGET=workerのとき、pushイベントで外部Worker(cf-auth)のURLへfetchする', async () => {
    let receivedBody: unknown = null;
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      receivedBody = JSON.parse(String(init?.body ?? '{}'));
      return new Response('ok', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const body = JSON.stringify({
      ref: 'refs/heads/main',
      repository: { id: 1, name: 'rails-root', full_name: 'nekoserver/rails-root', private: true },
      pusher: { name: 'okiraku' },
      commits: [{ id: 'a', message: 'first commit' }],
      head_commit: { id: 'a', message: 'first commit' },
      compare: 'https://github.com/nekoserver/rails-root/compare/a...b',
    });

    const response = await postPushWebhook(body, {
      GITHUB_WEBHOOK_SECRET: secret,
      DB: noopDb(),
      NOTIFY_TARGET: 'worker',
      NOTIFY_WORKER_URL: 'https://notify.example.com/ingest',
      NOTIFY_WORKER_SECRET: 'worker-secret',
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0]![0]);
    expect(calledUrl).toBe('https://notify.example.com/ingest');
    const sentText = (receivedBody as { text: string }).text;
    expect(sentText).toContain('nekoserver/rails-root');
    expect(sentText).toContain('main');
    expect(sentText).toContain('okiraku');
    // channelにSlackチャンネル名ではなくリポジトリ名を渡す。cf-auth側の/ingestが
    // これをalt_notify_ingest_log.channelへ保存し、リポジトリ単位で絞り込める
    // ようにするため(2026-10-04、rails-rootのpushコミットがcf-auth側で
    // リポジトリ別に読み出せなかった不具合の修正)。
    expect((receivedBody as { channel: string }).channel).toBe('nekoserver/rails-root');
  });

  it('通知先が未設定の場合は通知をスキップするが200は返す(処理は止めない)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const body = JSON.stringify({
      ref: 'refs/heads/main',
      repository: { id: 1, name: 'rails-root', full_name: 'nekoserver/rails-root', private: true },
      commits: [],
    });

    const response = await postPushWebhook(body, { GITHUB_WEBHOOK_SECRET: secret, DB: noopDb() });
    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
