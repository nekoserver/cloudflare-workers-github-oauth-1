import { describe, it, expect } from 'vitest';
import {
  isValidEcPublicKeyJwk,
  validateChallengeRow,
  computeChallengeExpiresAt,
  generateChallengeValue,
  verifyChallengeSignature,
  base64UrlEncode,
  resolvePublicKeyExpiryDays,
  computePublicKeyExpiresAt,
  isPublicKeyExpired,
  type PublicKeyChallengeRow,
} from './utils/publicKeyAuth';

// 対象: 公開鍵登録 + チャレンジ署名によるログイン認証(2要素目)。
// 新ページ(/public-keys)でユーザーがブラウザ生成した公開鍵(ECDSA P-256)を
// サーバーに登録し、ログイン時にサーバーが発行したチャレンジへの署名を
// 手元の秘密鍵で作って照合する。src/utils/publicKeyAuth.ts の純粋関数群
// (DBアクセスなし)をテストする。
//
// 故障シナリオ:
//   (1) 秘密鍵成分(d)を含むJWKを誤って公開鍵として受理してしまう
//   (2) チャレンジの期限切れ・二重使用(リプレイ)・他ユーザーのチャレンジ
//       流用を見逃す
//   (3) 署名検証が、正しい鍵ペアの署名を誤ってrejectする、または
//       改ざんされたチャレンジ/別鍵の署名を誤ってacceptしてしまう

async function generateTestKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  ) as Promise<CryptoKeyPair>;
}

async function signChallenge(privateKey: CryptoKey, challenge: string): Promise<string> {
  const data = new TextEncoder().encode(challenge);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, data);
  return base64UrlEncode(signature);
}

describe('isValidEcPublicKeyJwk', () => {
  it('正しいEC P-256公開鍵JWKを受理する', async () => {
    const { publicKey } = await generateTestKeyPair();
    const jwk = await crypto.subtle.exportKey('jwk', publicKey);
    expect(isValidEcPublicKeyJwk(jwk)).toBe(true);
  });

  it('秘密鍵成分(d)を含むJWKは拒否する', async () => {
    const { privateKey } = await generateTestKeyPair();
    const jwk = await crypto.subtle.exportKey('jwk', privateKey);
    expect(isValidEcPublicKeyJwk(jwk)).toBe(false);
  });

  it('kty/crvが異なるJWKは拒否する', () => {
    expect(isValidEcPublicKeyJwk({ kty: 'RSA', crv: 'P-256', x: 'a', y: 'b' })).toBe(false);
    expect(isValidEcPublicKeyJwk({ kty: 'EC', crv: 'P-384', x: 'a', y: 'b' })).toBe(false);
  });

  it('x/yが欠けたJWKは拒否する', () => {
    expect(isValidEcPublicKeyJwk({ kty: 'EC', crv: 'P-256' })).toBe(false);
  });

  it('null/非オブジェクトは拒否する', () => {
    expect(isValidEcPublicKeyJwk(null)).toBe(false);
    expect(isValidEcPublicKeyJwk('not an object')).toBe(false);
  });
});

describe('validateChallengeRow', () => {
  const now = new Date('2026-09-03T00:00:00Z');
  const baseRow: PublicKeyChallengeRow = {
    user_id: 'user-1',
    key_id: 'key-1',
    challenge: 'abc',
    expires_at: new Date(now.getTime() + 60_000).toISOString(),
    used_at: null,
  };

  it('有効なチャレンジはvalid:trueを返す', () => {
    expect(validateChallengeRow(baseRow, 'user-1', now)).toEqual({ valid: true });
  });

  it('行が存在しない場合はnot_found', () => {
    expect(validateChallengeRow(null, 'user-1', now)).toEqual({ valid: false, reason: 'not_found' });
  });

  it('他ユーザーのチャレンジはuser_mismatch', () => {
    expect(validateChallengeRow(baseRow, 'other-user', now)).toEqual({ valid: false, reason: 'user_mismatch' });
  });

  it('使用済みチャレンジはalready_used(リプレイ防止)', () => {
    const used = { ...baseRow, used_at: now.toISOString() };
    expect(validateChallengeRow(used, 'user-1', now)).toEqual({ valid: false, reason: 'already_used' });
  });

  it('期限切れチャレンジはexpired', () => {
    const expired = { ...baseRow, expires_at: new Date(now.getTime() - 1).toISOString() };
    expect(validateChallengeRow(expired, 'user-1', now)).toEqual({ valid: false, reason: 'expired' });
  });
});

describe('computeChallengeExpiresAt / generateChallengeValue', () => {
  it('TTL秒後のISO文字列を返す', () => {
    const now = new Date('2026-09-03T00:00:00Z');
    const expiresAt = computeChallengeExpiresAt(now);
    expect(new Date(expiresAt).getTime() - now.getTime()).toBe(5 * 60 * 1000);
  });

  it('毎回異なるランダム値を生成する', () => {
    const a = generateChallengeValue();
    const b = generateChallengeValue();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(20);
  });
});

describe('verifyChallengeSignature', () => {
  it('正しい鍵ペアで署名したチャレンジはverifyが成功する', async () => {
    const { publicKey, privateKey } = await generateTestKeyPair();
    const jwk = await crypto.subtle.exportKey('jwk', publicKey);
    const challenge = generateChallengeValue();
    const signature = await signChallenge(privateKey, challenge);

    const ok = await verifyChallengeSignature(JSON.stringify(jwk), challenge, signature);
    expect(ok).toBe(true);
  });

  it('チャレンジ文字列が改ざんされていると失敗する', async () => {
    const { publicKey, privateKey } = await generateTestKeyPair();
    const jwk = await crypto.subtle.exportKey('jwk', publicKey);
    const challenge = generateChallengeValue();
    const signature = await signChallenge(privateKey, challenge);

    const ok = await verifyChallengeSignature(JSON.stringify(jwk), challenge + 'x', signature);
    expect(ok).toBe(false);
  });

  it('別の鍵ペアの署名は失敗する(なりすまし防止)', async () => {
    const { publicKey } = await generateTestKeyPair();
    const otherPair = await generateTestKeyPair();
    const jwk = await crypto.subtle.exportKey('jwk', publicKey);
    const challenge = generateChallengeValue();
    const signature = await signChallenge(otherPair.privateKey, challenge);

    const ok = await verifyChallengeSignature(JSON.stringify(jwk), challenge, signature);
    expect(ok).toBe(false);
  });

  it('秘密鍵成分を含むJWKを公開鍵として渡すとfalseを返す(importKeyを呼ばず拒否)', async () => {
    const { privateKey } = await generateTestKeyPair();
    const jwk = await crypto.subtle.exportKey('jwk', privateKey);
    const ok = await verifyChallengeSignature(JSON.stringify(jwk), 'anything', 'AAAA');
    expect(ok).toBe(false);
  });
});

describe('resolvePublicKeyExpiryDays', () => {
  it('30/90/365/730/1825はそのまま許可する', () => {
    expect(resolvePublicKeyExpiryDays(30)).toBe(30);
    expect(resolvePublicKeyExpiryDays(90)).toBe(90);
    expect(resolvePublicKeyExpiryDays(365)).toBe(365);
    expect(resolvePublicKeyExpiryDays(730)).toBe(730);
    expect(resolvePublicKeyExpiryDays(1825)).toBe(1825);
  });

  it('文字列で渡されても数値として解釈する', () => {
    expect(resolvePublicKeyExpiryDays('365')).toBe(365);
  });

  it('null/undefined/空文字/"none"は無期限(null)を返す', () => {
    expect(resolvePublicKeyExpiryDays(null)).toBeNull();
    expect(resolvePublicKeyExpiryDays(undefined)).toBeNull();
    expect(resolvePublicKeyExpiryDays('')).toBeNull();
    expect(resolvePublicKeyExpiryDays('none')).toBeNull();
  });

  it('許可されていない値(不正な日数)は無期限にフォールバックする(短命化事故を防ぐ)', () => {
    expect(resolvePublicKeyExpiryDays(7)).toBeNull();
    expect(resolvePublicKeyExpiryDays('abc')).toBeNull();
    expect(resolvePublicKeyExpiryDays(-1)).toBeNull();
  });
});

describe('computePublicKeyExpiresAt', () => {
  const now = new Date('2026-09-03T00:00:00Z');

  it('nullを渡すとnull(無期限)を返す', () => {
    expect(computePublicKeyExpiresAt(null, now)).toBeNull();
  });

  it('30日後のISO文字列を返す', () => {
    const result = computePublicKeyExpiresAt(30, now);
    expect(new Date(result!).getTime() - now.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('1年(365日)後のISO文字列を返す', () => {
    const result = computePublicKeyExpiresAt(365, now);
    expect(new Date(result!).getTime() - now.getTime()).toBe(365 * 24 * 60 * 60 * 1000);
  });

  it('5年(1825日)後のISO文字列を返す', () => {
    const result = computePublicKeyExpiresAt(1825, now);
    expect(new Date(result!).getTime() - now.getTime()).toBe(1825 * 24 * 60 * 60 * 1000);
  });
});

describe('isPublicKeyExpired', () => {
  const now = new Date('2026-09-03T00:00:00Z');

  it('expires_atがnull(無期限)なら常にfalse', () => {
    expect(isPublicKeyExpired(null, now)).toBe(false);
  });

  it('現在時刻より未来ならfalse', () => {
    expect(isPublicKeyExpired(new Date(now.getTime() + 1000).toISOString(), now)).toBe(false);
  });

  it('現在時刻を過ぎていればtrue', () => {
    expect(isPublicKeyExpired(new Date(now.getTime() - 1000).toISOString(), now)).toBe(true);
  });

  it('現在時刻ちょうどはtrue(境界値)', () => {
    expect(isPublicKeyExpired(now.toISOString(), now)).toBe(true);
  });
});
