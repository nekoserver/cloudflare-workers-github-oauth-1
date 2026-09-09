import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { verifyResendWebhookSignature } from './utils/resendWebhook';

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');

const routeBlock = (() => {
  const idx = src.indexOf("app.post('/webhook/cf-wh1'");
  const end = src.indexOf('\n});', idx) + 4;
  return src.slice(idx, end);
})();

describe("POST /webhook/cf-wh1", () => {
  it('存在する', () => {
    expect(routeBlock.length).toBeGreaterThan(0);
  });

  it('CF_WH1_WEBHOOK_SECRETが未設定なら500を返す', () => {
    expect(routeBlock).toContain('const webhookSecret = c.env.CF_WH1_WEBHOOK_SECRET;');
    expect(routeBlock).toMatch(/if \(!webhookSecret\) \{[\s\S]*?return c\.json\(\{ error: 'Webhook endpoint is not available' \}, 500\);/);
  });

  it('webhook-id/webhook-timestamp/webhook-signatureヘッダーをverifyResendWebhookSignatureで検証する(Standard Webhooks形式)', () => {
    expect(routeBlock).toContain("id: c.req.header('webhook-id')");
    expect(routeBlock).toContain("timestamp: c.req.header('webhook-timestamp')");
    expect(routeBlock).toContain("signature: c.req.header('webhook-signature')");
    expect(routeBlock).toContain('await verifyResendWebhookSignature(rawBody, {');
  });

  it('検証失敗時は401を返しwebhook_logへrejectedとして記録する', () => {
    expect(routeBlock).toMatch(/if \(!verification\.success\) \{[\s\S]*?logWebhookEvent\(c\.env\.DB, 'cf-wh1', null, 'rejected', null, verification\.reason\)[\s\S]*?return c\.json\(\{ error: 'Unauthorized webhook' \}, 401\);/);
  });

  it('不正なJSONペイロードは400を返しwebhook_logへerrorとして記録する', () => {
    expect(routeBlock).toMatch(/catch \{[\s\S]*?logWebhookEvent\(c\.env\.DB, 'cf-wh1', null, 'error', null, 'Invalid JSON payload'\)[\s\S]*?return c\.json\(\{ error: 'Invalid webhook payload' \}, 400\);/);
  });

  it('検証成功時はwebhook_logへokとして記録し200でOKを返す', () => {
    expect(routeBlock).toContain("logWebhookEvent(c.env.DB, 'cf-wh1', event, 'ok', payload)");
    expect(routeBlock).toContain("return c.json({ result: 'OK' });");
  });
});

describe('Standard Webhooks形式の署名検証(実データフロー)', () => {
  it('webhook-id/webhook-timestamp/webhook-signatureヘッダー相当の値で正しく署名検証が通る', async () => {
    const secret = 'whsec_dGVzdC1zZWNyZXQta2V5LWZvci1jZi13aDE=';
    const rawBody = JSON.stringify({ event: 'test.event' });
    const id = 'msg_test123';
    const timestamp = String(Math.floor(Date.now() / 1000));

    const key = await crypto.subtle.importKey(
      'raw',
      Uint8Array.from(atob(secret.replace(/^whsec_/, '')), (ch) => ch.charCodeAt(0)) as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`));
    const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

    const result = await verifyResendWebhookSignature(rawBody, {
      id,
      timestamp,
      signature: `v1,${sigBase64}`,
    }, secret);

    expect(result.success).toBe(true);
  });

  it('署名が一致しない場合は失敗する', async () => {
    const result = await verifyResendWebhookSignature(
      JSON.stringify({ event: 'test.event' }),
      { id: 'msg_test123', timestamp: String(Math.floor(Date.now() / 1000)), signature: 'v1,aW52YWxpZA==' },
      'whsec_dGVzdC1zZWNyZXQta2V5LWZvci1jZi13aDE='
    );
    expect(result.success).toBe(false);
  });
});
