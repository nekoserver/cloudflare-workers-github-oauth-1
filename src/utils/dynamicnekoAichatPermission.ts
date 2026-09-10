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

/** dynamicnekoのAIモデル選択ドロップダウンのデフォルト値 */
export const DYNAMICNEKO_AICHAT_DEFAULT_MODEL = '@cf/google/gemma-4-26b-a4b-it';

/** dynamicnekoのAIモデル選択ドロップダウンで選択可能なモデルID一覧(デフォルトを含む) */
export const DYNAMICNEKO_AICHAT_ALLOWED_MODELS: readonly string[] = [
  DYNAMICNEKO_AICHAT_DEFAULT_MODEL,
  '@cf/qwen/qwen3.8-27b',
];

/**
 * dynamicnekoから指定されたモデルIDを、実際にAI.run()へ渡すモデルIDへ解決する。
 * 許可リストに無い値(未指定・改ざん・タイポ等)は常にデフォルト(Gemma-4)へ
 * フォールバックする(不明なモデルIDをそのままAI.run()へ渡してエラーにしない)。
 */
export function resolveDynamicnekoAichatModel(requestedModel: string | undefined | null): string {
  const trimmed = (requestedModel ?? '').trim();
  return DYNAMICNEKO_AICHAT_ALLOWED_MODELS.includes(trimmed) ? trimmed : DYNAMICNEKO_AICHAT_DEFAULT_MODEL;
}
