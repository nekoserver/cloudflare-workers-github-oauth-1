/**
 * POST /webhook/cf-wh1の実際のHTTPレスポンスを検証する振る舞いテスト。
 *
 * 旧版はsrc/index.tsをソーステキストとして読み、特定の文字列が含まれるかだけを
 * 検証していた(実際にリクエストを送って200/401/500が本当に返るかは未検証)。
 * ここでは実際に正しい/不正なStandard Webhooks署名を作ってapp.request()で送り、
 * レスポンスを検証する。
 */
import { describe, it, expect } from 'vitest';
import app from './index';
import { verifyResendWebhookSignature } from './utils/resendWebhook';

const SECRET = 'whsec_dGVzdC1zZWNyZXQta2V5LWZvci1jZi13aDE=';

async function signCfWh1(id: string, timestamp: string, rawBody: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(atob(secret.replace(/^whsec_/, '')), (ch) => ch.charCodeAt(0)) as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`));
  const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
  return `v1,${sigBase64}`;
}

describe('POST /webhook/cf-wh1', () => {
  it('CF_WH1_WEBHOOK_SECRETが未設定なら500を返す', async () => {
    const res = await app.request('/webhook/cf-wh1', { method: 'POST', body: '{}' }, {});
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Webhook endpoint is not available' });
  });

  it('署名ヘッダーが無い/不正な場合は401を返す', async () => {
    const res = await app.request(
      '/webhook/cf-wh1',
      {
        method: 'POST',
        headers: { 'webhook-id': 'msg_1', 'webhook-timestamp': String(Math.floor(Date.now() / 1000)), 'webhook-signature': 'v1,aW52YWxpZA==' },
        body: JSON.stringify({ event: 'test.event' }),
      },
      { CF_WH1_WEBHOOK_SECRET: SECRET }
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized webhook' });
  });

  it('署名が正しいが本文が不正なJSONの場合は400を返す', async () => {
    const id = 'msg_2';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = '{not-json';
    const signature = await signCfWh1(id, timestamp, rawBody, SECRET);
    const res = await app.request(
      '/webhook/cf-wh1',
      {
        method: 'POST',
        headers: { 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': signature },
        body: rawBody,
      },
      { CF_WH1_WEBHOOK_SECRET: SECRET }
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid webhook payload' });
  });

  it('署名・本文ともに正しい場合は200とresult:OKを返す', async () => {
    const id = 'msg_3';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify({ event: 'test.event' });
    const signature = await signCfWh1(id, timestamp, rawBody, SECRET);
    const res = await app.request(
      '/webhook/cf-wh1',
      {
        method: 'POST',
        headers: { 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': signature },
        body: rawBody,
      },
      { CF_WH1_WEBHOOK_SECRET: SECRET }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: 'OK' });
  });
});

describe('Standard Webhooks形式の署名検証(ユニット)', () => {
  it('webhook-id/webhook-timestamp/webhook-signatureヘッダー相当の値で正しく署名検証が通る', async () => {
    const rawBody = JSON.stringify({ event: 'test.event' });
    const id = 'msg_test123';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await signCfWh1(id, timestamp, rawBody, SECRET);
    const result = await verifyResendWebhookSignature(rawBody, { id, timestamp, signature }, SECRET);
    expect(result.success).toBe(true);
  });

  it('署名が一致しない場合は失敗する', async () => {
    const result = await verifyResendWebhookSignature(
      JSON.stringify({ event: 'test.event' }),
      { id: 'msg_test123', timestamp: String(Math.floor(Date.now() / 1000)), signature: 'v1,aW52YWxpZA==' },
      SECRET
    );
    expect(result.success).toBe(false);
  });
});
