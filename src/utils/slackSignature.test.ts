import { describe, it, expect, vi, afterEach } from 'vitest';
import { verifySlackSignature } from './slackSignature';

async function makeValidSignature(body: string, timestamp: string, secret: string): Promise<string> {
  const sigBasestring = `v0:${timestamp}:${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(sigBasestring));
  return 'v0=' + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

describe('verifySlackSignature', () => {
  const secret = 'test-signing-secret';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('正しい署名で検証成功する', async () => {
    const body = 'payload=test';
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = await makeValidSignature(body, ts, secret);

    const result = await verifySlackSignature(body, ts, sig, secret);
    expect(result.success).toBe(true);
  });

  it('timestamp が未指定なら失敗する', async () => {
    const result = await verifySlackSignature('body', undefined, 'v0=abc', secret);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('Timestamp');
  });

  it('signature が未指定なら失敗する', async () => {
    const result = await verifySlackSignature('body', '123', undefined, secret);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('Signature');
  });

  it('timestamp が古すぎると失敗する', async () => {
    const oldTs = String(Math.floor(Date.now() / 1000) - 600);
    const sig = await makeValidSignature('body', oldTs, secret);

    const result = await verifySlackSignature('body', oldTs, sig, secret);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('too old');
  });

  it('不正な署名は失敗する', async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const result = await verifySlackSignature('body', ts, 'v0=0000000000000000000000000000000000000000000000000000000000000000', secret);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('mismatch');
  });

  it('不正な timestamp 形式は失敗する', async () => {
    const result = await verifySlackSignature('body', 'not-a-number', 'v0=abc', secret);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('Invalid timestamp');
  });
});
