import { describe, it, expect } from 'vitest';
import { verifyTailscaleWebhookSignature } from './tailscaleWebhook';

// 対象: POST /webhook/tsが使うTailscale Webhookの署名検証
// (verifyTailscaleWebhookSignature)。Tailscale-Webhook-Signatureヘッダー
// (t=<unix秒>,v1=<hex>形式)を、CF_WEBHOOK_SECRETで検証する。

async function signPayload(secret: string, timestamp: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('verifyTailscaleWebhookSignature', () => {
  const secret = 'test-secret';
  const rawBody = '{"type":"nodeCreated","tailnet":"example.ts.net"}';

  it('ヘッダーが無い場合は失敗する', async () => {
    const result = await verifyTailscaleWebhookSignature(rawBody, undefined, secret);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('Missing');
  });

  it('t=/v1=を含まない形式は失敗する', async () => {
    const result = await verifyTailscaleWebhookSignature(rawBody, 'bogus-header', secret);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('Invalid signature format');
  });

  it('正しい署名・タイムスタンプなら成功する', async () => {
    const now = Math.floor(Date.now() / 1000);
    const sig = await signPayload(secret, String(now), rawBody);
    const result = await verifyTailscaleWebhookSignature(rawBody, `t=${now},v1=${sig}`, secret, now);
    expect(result.success).toBe(true);
  });

  it('secretが違うと署名不一致で失敗する', async () => {
    const now = Math.floor(Date.now() / 1000);
    const sig = await signPayload('other-secret', String(now), rawBody);
    const result = await verifyTailscaleWebhookSignature(rawBody, `t=${now},v1=${sig}`, secret, now);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('Signature mismatch');
  });

  it('rawBodyが改変されると署名不一致で失敗する', async () => {
    const now = Math.floor(Date.now() / 1000);
    const sig = await signPayload(secret, String(now), rawBody);
    const result = await verifyTailscaleWebhookSignature('{"type":"tampered"}', `t=${now},v1=${sig}`, secret, now);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('Signature mismatch');
  });

  it('タイムスタンプが許容範囲(5分)を超えて古いと失敗する(リプレイ対策)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const old = now - 10 * 60;
    const sig = await signPayload(secret, String(old), rawBody);
    const result = await verifyTailscaleWebhookSignature(rawBody, `t=${old},v1=${sig}`, secret, now);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('Timestamp outside tolerance window');
  });

  it('タイムスタンプが数値でない場合は失敗する', async () => {
    const result = await verifyTailscaleWebhookSignature(rawBody, 't=not-a-number,v1=deadbeef', secret);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('Invalid timestamp');
  });
});
