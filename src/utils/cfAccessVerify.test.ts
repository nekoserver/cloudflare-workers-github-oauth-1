import { describe, expect, it } from 'vitest';
import {
  parseAccessJwt,
  verifyAccessJwtSignature,
  isEmailAllowed,
  isAudValid,
  isTokenExpired,
  isHostAppropriate,
  buildAccessVerificationReport,
  type AccessCertsResponse,
} from './cfAccessVerify';

function base64Url(obj: unknown): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildFakeJwt(header: Record<string, unknown>, payload: Record<string, unknown>, signatureBytes = new Uint8Array([1, 2, 3])): string {
  const sigB64 = btoa(String.fromCharCode(...signatureBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${base64Url(header)}.${base64Url(payload)}.${sigB64}`;
}

async function generateRsaKeyPair() {
  return crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  );
}

describe('parseAccessJwt', () => {
  it('正しい形式のJWTのヘッダー・ペイロードを解析する', () => {
    const token = buildFakeJwt({ alg: 'RS256', kid: 'abc' }, { email: 'user@example.com', aud: 'tag1', exp: 9999999999 });
    const parsed = parseAccessJwt(token);
    expect(parsed).not.toBeNull();
    expect(parsed?.header.kid).toBe('abc');
    expect(parsed?.payload.email).toBe('user@example.com');
  });

  it('ドットで3分割できない文字列はnullを返す', () => {
    expect(parseAccessJwt('not-a-jwt')).toBeNull();
    expect(parseAccessJwt('a.b')).toBeNull();
    expect(parseAccessJwt('a..c')).toBeNull();
  });

  it('JSONとして解釈できないパーツがある場合はnullを返す', () => {
    const bogus = `${btoa('not-json').replace(/\+/g, '-').replace(/\//g, '_')}.${base64Url({ email: 'x' })}.sig`;
    expect(parseAccessJwt(bogus)).toBeNull();
  });
});

describe('verifyAccessJwtSignature', () => {
  it('正しい鍵で署名した場合は検証に成功する', async () => {
    const { privateKey, publicKey } = await generateRsaKeyPair();
    const jwk = await crypto.subtle.exportKey('jwk', publicKey);
    const header = { alg: 'RS256', kid: 'key-1' };
    const payload = { email: 'user@example.com' };
    const signingInput = `${base64Url(header)}.${base64Url(payload)}`;
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(signingInput));

    const parsed = { header, payload, signingInput, signature: new Uint8Array(signature) };
    const certs: AccessCertsResponse = { keys: [{ ...(jwk as JsonWebKey), kid: 'key-1' }] };

    expect(await verifyAccessJwtSignature(parsed, certs)).toBe(true);
  });

  it('改ざんされた本文(別の署名対象文字列)では検証に失敗する', async () => {
    const { privateKey, publicKey } = await generateRsaKeyPair();
    const jwk = await crypto.subtle.exportKey('jwk', publicKey);
    const header = { alg: 'RS256', kid: 'key-1' };
    const originalPayload = { email: 'user@example.com' };
    const signingInput = `${base64Url(header)}.${base64Url(originalPayload)}`;
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(signingInput));

    const tamperedPayload = { email: 'attacker@evil.com' };
    const tamperedSigningInput = `${base64Url(header)}.${base64Url(tamperedPayload)}`;
    const parsed = { header, payload: tamperedPayload, signingInput: tamperedSigningInput, signature: new Uint8Array(signature) };
    const certs: AccessCertsResponse = { keys: [{ ...(jwk as JsonWebKey), kid: 'key-1' }] };

    expect(await verifyAccessJwtSignature(parsed, certs)).toBe(false);
  });

  it('一致する鍵が無い場合は検証に失敗する', async () => {
    const parsed = { header: { kid: 'unknown' }, payload: {}, signingInput: 'a.b', signature: new Uint8Array([1, 2, 3]) };
    const certs: AccessCertsResponse = { keys: [] };
    expect(await verifyAccessJwtSignature(parsed, certs)).toBe(false);
  });
});

describe('isEmailAllowed', () => {
  it('許可リスト未設定なら常にtrue(制限なし)', () => {
    expect(isEmailAllowed('user@example.com', undefined)).toBe(true);
    expect(isEmailAllowed(undefined, undefined)).toBe(true);
    expect(isEmailAllowed(undefined, '')).toBe(true);
  });

  it('許可ドメインに含まれるメールはtrue', () => {
    expect(isEmailAllowed('user@example.com', 'example.com,other.com')).toBe(true);
  });

  it('許可ドメインに含まれないメールはfalse', () => {
    expect(isEmailAllowed('user@evil.com', 'example.com,other.com')).toBe(false);
  });

  it('許可リスト設定済みでemailが無い場合はfalse', () => {
    expect(isEmailAllowed(undefined, 'example.com')).toBe(false);
  });

  it('大文字小文字・前後空白を区別しない', () => {
    expect(isEmailAllowed('USER@Example.COM', ' example.com , other.com ')).toBe(true);
  });
});

describe('isAudValid', () => {
  it('期待値未設定なら常にtrue', () => {
    expect(isAudValid({}, undefined)).toBe(true);
  });

  it('aud(文字列)が一致すればtrue', () => {
    expect(isAudValid({ aud: 'tag1' }, 'tag1')).toBe(true);
    expect(isAudValid({ aud: 'tag2' }, 'tag1')).toBe(false);
  });

  it('aud(配列)に含まれていればtrue', () => {
    expect(isAudValid({ aud: ['tag1', 'tag2'] }, 'tag2')).toBe(true);
    expect(isAudValid({ aud: ['tag1'] }, 'tag2')).toBe(false);
  });

  it('audが無い場合はfalse(期待値設定済みのとき)', () => {
    expect(isAudValid({}, 'tag1')).toBe(false);
  });
});

describe('isTokenExpired', () => {
  it('exp未来なら期限内(false)', () => {
    expect(isTokenExpired({ exp: 9999999999 }, 1000)).toBe(false);
  });

  it('exp過去なら期限切れ(true)', () => {
    expect(isTokenExpired({ exp: 500 }, 1000)).toBe(true);
  });

  it('expが無い・数値でない場合は期限切れ扱い(true)', () => {
    expect(isTokenExpired({}, 1000)).toBe(true);
  });
});

describe('isHostAppropriate', () => {
  it('期待値未設定なら常にtrue', () => {
    expect(isHostAppropriate('anything.workers.dev', undefined)).toBe(true);
  });

  it('Hostが期待値と一致すればtrue', () => {
    expect(isHostAppropriate('app.example.com', 'app.example.com')).toBe(true);
  });

  it('Hostが期待値と異なればfalse(大文字小文字は区別しない)', () => {
    expect(isHostAppropriate('App.Example.com', 'app.example.com')).toBe(true);
    expect(isHostAppropriate('direct.workers.dev', 'app.example.com')).toBe(false);
  });

  it('Hostヘッダーが無い場合はfalse(期待値設定済みのとき)', () => {
    expect(isHostAppropriate(undefined, 'app.example.com')).toBe(false);
  });
});

describe('buildAccessVerificationReport', () => {
  it('JWTが無い場合はjwt_presentがfailし、overallはfail', () => {
    const report = buildAccessVerificationReport({
      rawToken: undefined,
      parsed: null,
      signatureValid: null,
      hostHeader: undefined,
      config: {},
    });
    expect(report.overall).toBe('fail');
    expect(report.checks.find((c) => c.key === 'jwt_present')?.status).toBe('fail');
  });

  it('すべての設定が未設定でもJWTがあり解析できればjwt_present/jwt_formatはpassし、他はskippedになる', () => {
    const parsed = { header: { alg: 'RS256' }, payload: { email: 'user@example.com', exp: 9999999999 }, signingInput: 'a.b', signature: new Uint8Array([1]) };
    const report = buildAccessVerificationReport({
      rawToken: 'a.b.c',
      parsed,
      signatureValid: null,
      hostHeader: 'app.workers.dev',
      config: {},
    });
    expect(report.checks.find((c) => c.key === 'jwt_present')?.status).toBe('pass');
    expect(report.checks.find((c) => c.key === 'jwt_format')?.status).toBe('pass');
    expect(report.checks.find((c) => c.key === 'jwt_signature')?.status).toBe('skipped');
    expect(report.checks.find((c) => c.key === 'jwt_aud')?.status).toBe('skipped');
    expect(report.checks.find((c) => c.key === 'email_domain')?.status).toBe('skipped');
    expect(report.checks.find((c) => c.key === 'gateway_host')?.status).toBe('skipped');
    expect(report.overall).toBe('pass');
    expect(report.email).toBe('user@example.com');
  });

  it('すべての設定が有効かつ条件を満たせばoverallはpass', () => {
    const parsed = { header: { alg: 'RS256' }, payload: { email: 'user@example.com', aud: 'tag1', exp: 9999999999 }, signingInput: 'a.b', signature: new Uint8Array([1]) };
    const report = buildAccessVerificationReport({
      rawToken: 'a.b.c',
      parsed,
      signatureValid: true,
      hostHeader: 'app.example.com',
      config: { teamDomain: 'myteam', expectedAud: 'tag1', allowedEmailDomainsCsv: 'example.com', expectedHost: 'app.example.com' },
    });
    expect(report.overall).toBe('pass');
    expect(report.checks.every((c) => c.status !== 'fail')).toBe(true);
  });

  it('署名検証失敗(signatureValid=false)ならoverallはfail', () => {
    const parsed = { header: { alg: 'RS256' }, payload: { email: 'user@example.com', exp: 9999999999 }, signingInput: 'a.b', signature: new Uint8Array([1]) };
    const report = buildAccessVerificationReport({
      rawToken: 'a.b.c',
      parsed,
      signatureValid: false,
      hostHeader: undefined,
      config: { teamDomain: 'myteam' },
    });
    expect(report.overall).toBe('fail');
    expect(report.checks.find((c) => c.key === 'jwt_signature')?.status).toBe('fail');
  });

  it('許可ドメイン外のメールならoverallはfail', () => {
    const parsed = { header: { alg: 'RS256' }, payload: { email: 'user@evil.com', exp: 9999999999 }, signingInput: 'a.b', signature: new Uint8Array([1]) };
    const report = buildAccessVerificationReport({
      rawToken: 'a.b.c',
      parsed,
      signatureValid: null,
      hostHeader: undefined,
      config: { allowedEmailDomainsCsv: 'example.com' },
    });
    expect(report.overall).toBe('fail');
    expect(report.checks.find((c) => c.key === 'email_domain')?.status).toBe('fail');
  });

  it('期限切れJWTならoverallはfail', () => {
    const parsed = { header: { alg: 'RS256' }, payload: { email: 'user@example.com', exp: 100 }, signingInput: 'a.b', signature: new Uint8Array([1]) };
    const report = buildAccessVerificationReport({
      rawToken: 'a.b.c',
      parsed,
      signatureValid: null,
      hostHeader: undefined,
      config: {},
      nowSeconds: 200,
    });
    expect(report.overall).toBe('fail');
    expect(report.checks.find((c) => c.key === 'jwt_expiry')?.status).toBe('fail');
  });

  it('Hostが期待値と異なればgateway_hostがfailしoverallもfail', () => {
    const report = buildAccessVerificationReport({
      rawToken: undefined,
      parsed: null,
      signatureValid: null,
      hostHeader: 'direct.workers.dev',
      config: { expectedHost: 'app.example.com' },
    });
    expect(report.checks.find((c) => c.key === 'gateway_host')?.status).toBe('fail');
    expect(report.overall).toBe('fail');
  });
});
