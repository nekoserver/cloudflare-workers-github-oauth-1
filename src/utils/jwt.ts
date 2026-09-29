/**
 * JWT認証ユーティリティ
 * Cloudflare WorkersのWeb Crypto APIを使用してJWTを生成・検証します
 */

export interface JWTPayload {
  sub: string; // ユーザーID
  name?: string; // ユーザー名
  email?: string; // メールアドレス
  github_id?: number; // GitHub ID
  github_access_token?: string; // GitHubアクセストークン（D1未使用時のフォールバック）
  iat: number; // 発行時刻
  exp: number; // 有効期限
}

const MAX_JWT_LENGTH = 16 * 1024;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Base64URL エンコード
 */
function base64UrlEncode(data: ArrayBuffer): string {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64URL デコード
 */
function base64UrlDecode(str: string): ArrayBuffer {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function decodeJsonSegment(segment: string): unknown {
  const decoded = base64UrlDecode(segment);
  return JSON.parse(new TextDecoder().decode(decoded));
}

function isValidPayload(value: unknown): value is JWTPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return typeof payload.sub === 'string'
    && payload.sub.length > 0
    && Number.isSafeInteger(payload.iat)
    && Number.isSafeInteger(payload.exp);
}

/**
 * 秘密鍵からCryptoKeyを生成
 */
async function getKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * JWTを生成
 */
export async function createJWT(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  secret: string,
  expiresIn: number = 3600,
  issuedAtSeconds: number = Math.floor(Date.now() / 1000)
): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const fullPayload: JWTPayload = {
    ...payload,
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + expiresIn
  };

  const encoder = new TextEncoder();
  const headerEncoded = base64UrlEncode(encoder.encode(JSON.stringify(header)).buffer as ArrayBuffer);
  const payloadEncoded = base64UrlEncode(encoder.encode(JSON.stringify(fullPayload)).buffer as ArrayBuffer);

  const data = `${headerEncoded}.${payloadEncoded}`;
  const key = await getKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const signatureEncoded = base64UrlEncode(signature);

  return `${data}.${signatureEncoded}`;
}

/**
 * JWTを検証
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    // Bound parsing/crypto work for attacker-controlled Authorization headers.
    if (!token || token.length > MAX_JWT_LENGTH) {
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
    if (!headerEncoded || !payloadEncoded || !signatureEncoded
      || !parts.every((part) => BASE64URL_PATTERN.test(part))) {
      return null;
    }

    // Never infer the algorithm from the key or merely trust a valid signature:
    // this verifier only accepts the exact JWT profile emitted by createJWT.
    const header = decodeJsonSegment(headerEncoded);
    if (!header || typeof header !== 'object' || Array.isArray(header)) {
      return null;
    }
    const headerRecord = header as Record<string, unknown>;
    if (headerRecord.alg !== 'HS256' || headerRecord.typ !== 'JWT') {
      return null;
    }

    const data = `${headerEncoded}.${payloadEncoded}`;

    // 署名を検証
    const encoder = new TextEncoder();
    const key = await getKey(secret);
    const signature = base64UrlDecode(signatureEncoded);
    // jsdom と Node の SubtleCrypto は ArrayBuffer の realm が異なり、
    // raw ArrayBuffer だと "3rd argument is not instance of ArrayBuffer" になる。
    // TypedArray ならどちらの実装でも受け付ける。
    const isValid = await crypto.subtle.verify('HMAC', key, new Uint8Array(signature), encoder.encode(data));

    if (!isValid) {
      return null;
    }

    // ペイロードをデコード
    const payload = decodeJsonSegment(payloadEncoded);
    if (!isValidPayload(payload)) {
      return null;
    }

    // Reject a token at the expiry boundary as required by the JWT exp claim.
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

/**
 * Bearerトークンを抽出
 */
export function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
