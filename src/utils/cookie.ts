/**
 * Cookie解析ユーティリティ
 * Cookie文字列の解析を一箇所に集約します
 */

/**
 * Cookie文字列から指定した名前の値を取得
 */
export function getCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const eqIdx = cookie.indexOf('=');
    if (eqIdx === -1) continue;
    const cookieName = cookie.substring(0, eqIdx).trim();
    const cookieValue = cookie.substring(eqIdx + 1).trim();
    if (cookieName === name) {
      return cookieValue;
    }
  }
  return null;
}

/**
 * Cookie文字列から複数の値をまとめて取得
 */
export function getCookieValues(cookieHeader: string | undefined, names: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const name of names) {
    result[name] = null;
  }

  if (!cookieHeader) return result;

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const eqIdx = cookie.indexOf('=');
    if (eqIdx === -1) continue;
    const cookieName = cookie.substring(0, eqIdx).trim();
    const cookieValue = cookie.substring(eqIdx + 1).trim();
    if (names.includes(cookieName)) {
      result[cookieName] = cookieValue;
    }
  }
  return result;
}
