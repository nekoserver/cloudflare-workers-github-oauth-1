import { describe, expect, it } from 'vitest';
import { createJWT, verifyJWT } from './jwt';

function encode(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function sign(header: unknown, payload: unknown, secret = 'test-secret'): Promise<string> {
  const data = `${encode(header)}.${encode(payload)}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
  let binary = '';
  for (const byte of signature) binary += String.fromCharCode(byte);
  return `${data}.${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`;
}

describe('JWT security validation', () => {
  it('accepts the HS256 JWT profile emitted by createJWT', async () => {
    const token = await createJWT({ sub: 'user-1' }, 'test-secret', 60);
    await expect(verifyJWT(token, 'test-secret')).resolves.toMatchObject({ sub: 'user-1' });
  });

  it('rejects a signed token that declares another algorithm', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await sign({ alg: 'none', typ: 'JWT' }, { sub: 'user-1', iat: now, exp: now + 60 });
    await expect(verifyJWT(token, 'test-secret')).resolves.toBeNull();
  });

  it.each([
    ['missing exp', { sub: 'user-1', iat: 1 }],
    ['empty subject', { sub: '', iat: 1, exp: 4_102_444_800 }],
    ['non-numeric issued-at', { sub: 'user-1', iat: '1', exp: 4_102_444_800 }],
  ])('rejects malformed registered claims: %s', async (_name, payload) => {
    const token = await sign({ alg: 'HS256', typ: 'JWT' }, payload);
    await expect(verifyJWT(token, 'test-secret')).resolves.toBeNull();
  });

  it('rejects a token exactly at its expiration boundary', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await createJWT({ sub: 'user-1' }, 'test-secret', 0, now);
    await expect(verifyJWT(token, 'test-secret')).resolves.toBeNull();
  });

  it('rejects oversized attacker-controlled tokens before verification', async () => {
    const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${'a'.repeat(17_000)}.AA`;
    await expect(verifyJWT(token, 'test-secret')).resolves.toBeNull();
  });
});
