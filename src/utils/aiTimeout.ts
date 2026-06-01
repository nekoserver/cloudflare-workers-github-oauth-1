export const AI_CLASSIFY_TIMEOUT_MS = 5000;

/**
 * Promiseにタイムアウトを設ける。
 * タイムアウトまたはrejectionの場合は空文字列を返す（AI分類失敗扱い）。
 */
export async function withAiTimeout(promise: Promise<string>, timeoutMs: number): Promise<string> {
  const timeout = new Promise<string>((resolve) => setTimeout(() => resolve(''), timeoutMs));
  try {
    return await Promise.race([promise, timeout]);
  } catch {
    return '';
  }
}
