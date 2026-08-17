/**
 * OAuth フロー中の return_to パラメータをバリデーションする
 *
 * オープンリダイレクト脆弱性を防ぐため、以下のルールで検証する:
 * - 相対パスのみ許可（/ で始まる）
 * - プロトコル付き URL は拒否
 * - // で始まるパスは拒否（protocol-relative URL）
 * - パストラバーサルは拒否
 *
 * 許可対象は同一オリジンの相対パス全般とする（個別ページの許可リストは持たない）。
 * 上記3チェックだけで外部ホストへのオープンリダイレクトは防げるため、
 * 許可リストによる追加の安全性向上はない。
 */

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

  return value;
}
