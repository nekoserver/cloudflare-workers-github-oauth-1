/**
 * cf-auth webhook のペイロードから判定対象のユーザー名を抽出する
 * username > user > login > email の優先順で最初に見つかった非空文字列を採用する
 */
export function extractCfAuthUsername(payload: Record<string, unknown>): string | null {
  const candidates = ['username', 'user', 'login', 'email'];
  for (const key of candidates) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}
