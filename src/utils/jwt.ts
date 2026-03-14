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
export async function createJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>, secret: string, expiresIn: number = 3600): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn
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
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
    const data = `${headerEncoded}.${payloadEncoded}`;

    // 署名を検証
    const encoder = new TextEncoder();
    const key = await getKey(secret);
    const signature = base64UrlDecode(signatureEncoded);
    const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(data));

    if (!isValid) {
      return null;
    }

    // ペイロードをデコード
    const payloadData = base64UrlDecode(payloadEncoded);
    const payloadString = new TextDecoder().decode(payloadData);
    const payload: JWTPayload = JSON.parse(payloadString);

    // 有効期限を確認
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
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
