/**
 * OAuth フロー中の return_to パラメータをバリデーションする
 *
 * オープンリダイレクト脆弱性を防ぐため、以下のルールで検証する:
 * - 相対パスのみ許可（/ で始まる）
 * - プロトコル付き URL は拒否
 * - // で始まるパスは拒否（protocol-relative URL）
 * - パストラバーサルは拒否
 * - 許可リスト内のパスのみ受け入れる
 */

/** return_to として許可するパスのプレフィックス */
const ALLOWED_RETURN_PREFIXES = [
  '/repositories',
  '/welcome',
  '/settings',
];

/**
 * return_to パラメータを検証し、安全な値のみ返す
 * 不正な値の場合は null を返す
 */
export function validateReturnTo(value: string | undefined | null): string | null {
  if (!value) return null;

  // 相対パスのみ許可
  if (!value.startsWith('/')) return null;

  // protocol-relative URL を拒否
  if (value.startsWith('//')) return null;

  // パストラバーサルを拒否
  if (value.includes('..')) return null;

  // 許可リスト内のパスプレフィックスに一致するか
  const matches = ALLOWED_RETURN_PREFIXES.some((prefix) => value === prefix || value.startsWith(prefix + '?') || value.startsWith(prefix + '/'));
  if (!matches) return null;

  return value;
}
