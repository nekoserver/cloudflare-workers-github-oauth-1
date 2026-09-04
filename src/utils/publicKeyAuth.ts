/**
 * 公開鍵登録 + チャレンジ署名によるログイン認証(2要素目)のユーティリティ。
 * DBアクセスを含まない純粋関数のみをここに置き、テスト可能にする
 * (CLAUDE.mdルール15: テスト対象のロジックは関数に切り出してからテストする)。
 *
 * 方式: ECDSA (P-256, SHA-256)。秘密鍵はブラウザ側で生成し外に出さない
 * (非exportable CryptoKeyとしてIndexedDB等に保持する想定)。サーバーには
 * 公開鍵(JWK)のみを登録し、ログイン時はサーバーが発行したランダムな
 * チャレンジ文字列に対する署名を検証する。
 */

export const CHALLENGE_TTL_SECONDS = 5 * 60;

/**
 * Base64URL エンコード(jwt.tsと同じ実装。共通化はせず独立させて
 * このモジュール単体でテスト・利用できるようにする)。
 */
export function base64UrlEncode(data: ArrayBuffer): string {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64URL デコード
 */
export function base64UrlDecode(str: string): ArrayBuffer {
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

/** サーバー側で発行するランダムなチャレンジ文字列(Base64URL, 32バイト由来)を生成する。 */
export function generateChallengeValue(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes.buffer);
}

/**
 * 登録リクエストで渡された公開鍵JWKが、ECDSA(P-256)の"公開鍵"として
 * 妥当な形かを検証する。秘密鍵成分(d)を含むJWKを誤って受理しない
 * (故障シナリオ: クライアントの実装ミスで秘密鍵ごと送ってしまう場合)。
 */
export function isValidEcPublicKeyJwk(jwk: unknown): jwk is JsonWebKey {
  if (!jwk || typeof jwk !== 'object') return false;
  const k = jwk as Record<string, unknown>;
  if (k.kty !== 'EC') return false;
  if (k.crv !== 'P-256') return false;
  if (typeof k.x !== 'string' || k.x.length === 0) return false;
  if (typeof k.y !== 'string' || k.y.length === 0) return false;
  if ('d' in k && k.d) return false; // 秘密鍵成分は拒否する
  return true;
}

export type PublicKeyExpiryDays = 30 | 90 | 365 | 730 | 1825 | null;

const ALLOWED_PUBLIC_KEY_EXPIRY_DAYS: ReadonlySet<number> = new Set([30, 90, 365, 730, 1825]);

/**
 * 公開鍵登録フォームから渡された有効期限入力を検証する。
 * 30日・90日・1年(365日)・2年(730日)・5年(1825日)・null(無期限)以外は
 * すべて無期限として扱わず、デフォルトの無期限にフォールバックする
 * (不正な値をそのまま短い期限として登録してしまい、意図せず鍵が
 * 使えなくなる事故を防ぐ。api_keysの30日デフォルトとは逆に、鍵の
 * 用途上「作ったら失効させるまで使い続ける」が既定の挙動だったため)。
 */
export function resolvePublicKeyExpiryDays(input: unknown): PublicKeyExpiryDays {
  if (input === null || input === undefined || input === 'null' || input === 'none' || input === '') return null;
  const n = typeof input === 'number' ? input : Number(input);
  if (Number.isFinite(n) && ALLOWED_PUBLIC_KEY_EXPIRY_DAYS.has(n)) return n as PublicKeyExpiryDays;
  return null;
}

/** 有効期限日数(または無期限)から、実際の有効期限ISO文字列(またはnull)を計算する。 */
export function computePublicKeyExpiresAt(days: PublicKeyExpiryDays, now: Date): string | null {
  if (days === null) return null;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

/** 公開鍵の有効期限(expires_at)が現在時刻を過ぎているかどうかを判定する。 */
export function isPublicKeyExpired(expiresAt: string | null, now: Date): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= now.getTime();
}

export type PublicKeyChallengeRow = {
  user_id: string;
  key_id: string;
  challenge: string;
  expires_at: string;
  used_at: string | null;
};

export type ChallengeValidationResult =
  | { valid: true }
  | { valid: false; reason: 'not_found' | 'expired' | 'already_used' | 'user_mismatch' };

/**
 * チャレンジ行(DBから取得したもの)が、指定ユーザーに対して今使用可能かを判定する。
 * 故障シナリオ: 期限切れ / 二重使用(リプレイ) / 他ユーザーのチャレンジ流用。
 */
export function validateChallengeRow(
  row: PublicKeyChallengeRow | null,
  userId: string,
  now: Date
): ChallengeValidationResult {
  if (!row) return { valid: false, reason: 'not_found' };
  if (row.user_id !== userId) return { valid: false, reason: 'user_mismatch' };
  if (row.used_at) return { valid: false, reason: 'already_used' };
  if (new Date(row.expires_at).getTime() <= now.getTime()) return { valid: false, reason: 'expired' };
  return { valid: true };
}

/** チャレンジの有効期限(ISO文字列)を計算する。 */
export function computeChallengeExpiresAt(now: Date): string {
  return new Date(now.getTime() + CHALLENGE_TTL_SECONDS * 1000).toISOString();
}

/**
 * 登録済み公開鍵(JWK文字列)とチャレンジ文字列・署名(いずれもBase64URL)から、
 * ECDSA署名を検証する。公開鍵JWKが壊れている場合はimportKeyが例外を投げるため
 * 呼び出し側でtry/catchすること。
 */
export async function verifyChallengeSignature(
  publicKeyJwkJson: string,
  challenge: string,
  signatureBase64Url: string
): Promise<boolean> {
  const jwk = JSON.parse(publicKeyJwkJson) as JsonWebKey;
  if (!isValidEcPublicKeyJwk(jwk)) return false;

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );

  const signature = base64UrlDecode(signatureBase64Url);
  const data = new TextEncoder().encode(challenge);

  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    signature,
    data
  );
}
