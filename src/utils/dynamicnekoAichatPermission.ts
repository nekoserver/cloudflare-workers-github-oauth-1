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

/**
 * emailに紐づく「サーバー側で登録済みの」GitHub loginを返す。
 *
 * 重要: これはクライアント(dynamicneko)がリクエスト本文で送ってくる`login`を
 * 一切受け取らない・信用しない設計にするための関数である。Bearer secretと
 * 許可済みメールアドレスさえ知っていれば、リクエスト本文のloginを任意の値に
 * 書き換えるだけで他ユーザーのuser_idとして検索・書き込みができてしまう
 * 脆弱性(PR #1809/#1810で混入)が実際に発覚した。emailはサーバー側で
 * dynamicneko_aichat_allowed_usersへの再検証を通過した値であり、そのemailに
 * 対して事前にDB側で紐づけて登録されたloginだけを信頼できる値として返す。
 *
 * 未登録メールアドレス・github_login未設定(NULL)・空白のみの場合は、
 * すべてnullを返す(空文字を返して呼び出し元がそれをuser_idとして使って
 * しまう事故を避けるため)。呼び出し元はnullの場合、エラーとして扱うこと。
 */
export async function resolveDynamicnekoAllowedLogin(db: D1Database, email: string): Promise<string | null> {
  const normalized = normalizeAllowlistEmail(email);
  if (!normalized) return null;
  const row = await db
    .prepare('SELECT github_login FROM dynamicneko_aichat_allowed_users WHERE lower(email) = ? LIMIT 1')
    .bind(normalized)
    .first<{ github_login: string | null } | null>();
  const login = row?.github_login?.trim();
  return login ? login : null;
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
