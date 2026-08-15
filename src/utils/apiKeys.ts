/**
 * APIキー機能のユーティリティ(ハッシュ化・生成・有効期限計算・判定)。
 * DBアクセスを含まない純粋関数のみをここに置き、テスト可能にする
 * (CLAUDE.mdルール15: テスト対象のロジックは関数に切り出してからテストする)。
 */
import { sha256Hex } from './contentHash';

export const API_KEY_PREFIX = 'nkapi_';

/**
 * 新規APIキーの生キー文字列を生成する。DBには保存せず、発行時に1回だけ
 * ユーザーへ表示する想定(以降はハッシュ照合のみ)。
 */
export function generateApiKeySecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${API_KEY_PREFIX}${hex}`;
}

/**
 * APIキー文字列をSHA-256でハッシュ化しhex文字列で返す。
 * 生キーはDBに保存せず、このハッシュ値のみを保存・照合に使う
 * (既存の sha256Hex をそのまま利用し、ハッシュ実装を重複させない)。
 */
export async function hashApiKey(rawKey: string): Promise<string> {
  return sha256Hex(rawKey);
}

/**
 * 一覧表示用に、生キーの先頭部分だけを残してマスクする(例: nkapi_ab12cd34********)。
 * 発行直後の一回きりの表示以外では、この値のみを画面に出す。
 */
export function maskApiKey(rawKey: string): string {
  const body = rawKey.startsWith(API_KEY_PREFIX) ? rawKey.slice(API_KEY_PREFIX.length) : rawKey;
  const visible = body.slice(0, 8);
  return `${API_KEY_PREFIX}${visible}${'*'.repeat(Math.max(0, body.length - visible.length))}`;
}

/**
 * 🔑キー管理ページの一覧表示で、マスク済みキー(key_prefix)がさらに長すぎるため、
 * 前半だけを残して切り詰める(奇数長は切り上げで前半に含める)。
 */
export function truncateKeyDisplay(keyPrefix: string): string {
  const half = Math.ceil(keyPrefix.length / 2);
  return keyPrefix.slice(0, half);
}

/** Authorizationヘッダのトークンが(セッションJWTではなく)APIキー形式かどうか判定する。 */
export function isApiKeyToken(token: string): boolean {
  return typeof token === 'string' && token.startsWith(API_KEY_PREFIX);
}

export type ApiKeyExpiryDays = 30 | 90 | null;

const ALLOWED_EXPIRY_DAYS: ReadonlySet<number> = new Set([30, 90]);

/**
 * APIキー発行フォームから渡された有効期限入力を検証する。
 * 30・90・null(無期限)以外はすべて無期限として扱わず、デフォルトの30日にフォールバックする
 * (不正な値をそのまま「無期限」として作成してしまう事故を防ぐ)。
 */
export function resolveApiKeyExpiryDays(input: unknown): ApiKeyExpiryDays {
  if (input === null || input === 'null' || input === 'none') return null;
  const n = typeof input === 'number' ? input : Number(input);
  if (Number.isFinite(n) && ALLOWED_EXPIRY_DAYS.has(n)) return n as 30 | 90;
  return 30;
}

/** 有効期限日数(または無期限)から、実際の有効期限ISO文字列(またはnull)を計算する。 */
export function computeApiKeyExpiresAt(days: ApiKeyExpiryDays, now: Date): string | null {
  if (days === null) return null;
  const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return expires.toISOString();
}

export type ApiKeyRow = {
  id: string;
  user_id: string;
  label: string;
  expires_at: string | null;
  revoked_at: string | null;
};

export type ApiKeyCheckResult =
  | { valid: true; userId: string }
  | { valid: false; reason: 'not_found' | 'revoked' | 'expired' | 'account_revoked' };

/**
 * APIキー1件の有効性を判定する(キー自体が失効/期限切れでないか、
 * かつそのキーの持ち主のアカウント自体が無効化されていないか、の2段階)。
 * DBアクセスを含まない純粋関数にすることで、故障シナリオ(失効・期限切れ・
 * アカウント無効化・キー未発見)ごとにユニットテストで検証できるようにする。
 */
export function evaluateApiKeyRow(
  row: ApiKeyRow | null,
  now: Date,
  accountRevoked: boolean
): ApiKeyCheckResult {
  if (!row) return { valid: false, reason: 'not_found' };
  if (row.revoked_at) return { valid: false, reason: 'revoked' };
  if (row.expires_at && new Date(row.expires_at).getTime() <= now.getTime()) {
    return { valid: false, reason: 'expired' };
  }
  if (accountRevoked) return { valid: false, reason: 'account_revoked' };
  return { valid: true, userId: row.user_id };
}
