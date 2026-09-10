/**
 * dynamicneko(Cloudflare Dynamic Worker Loader使用)のAI問い合わせウィジェットが
 * 利用できるユーザーを、D1のdynamicneko_aichat_allowed_usersテーブルへ登録された
 * メールアドレスに限定するための判定ロジック。
 */

/** メールアドレスの前後空白を除去し小文字化する。DB照合・入力比較の両方で使う */
export function normalizeAllowlistEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * emailがdynamicneko_aichat_allowed_usersに登録されているかをD1へ問い合わせる。
 * 空メールアドレスは常にfalse(DBへ問い合わせない)。
 */
export async function isDynamicnekoAichatAllowed(db: D1Database, email: string): Promise<boolean> {
  const normalized = normalizeAllowlistEmail(email);
  if (!normalized) return false;
  const row = await db
    .prepare('SELECT 1 FROM dynamicneko_aichat_allowed_users WHERE lower(email) = ? LIMIT 1')
    .bind(normalized)
    .first();
  return row !== null && row !== undefined;
}
