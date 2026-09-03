/**
 * ログイン方式(GitHub OAuth / 公開鍵チャレンジ署名)の識別・表示ラベルのユーティリティ。
 * DBアクセスを含まない純粋関数のみをここに置き、テスト可能にする
 * (CLAUDE.mdルール15: テスト対象のロジックは関数に切り出してからテストする)。
 */

export const LOGIN_METHOD_GITHUB_OAUTH = 'github_oauth' as const;
export const LOGIN_METHOD_PUBLIC_KEY = 'public_key' as const;

export type LoginMethod = typeof LOGIN_METHOD_GITHUB_OAUTH | typeof LOGIN_METHOD_PUBLIC_KEY;

const KNOWN_LOGIN_METHODS: ReadonlySet<string> = new Set([LOGIN_METHOD_GITHUB_OAUTH, LOGIN_METHOD_PUBLIC_KEY]);

export function isValidLoginMethod(value: unknown): value is LoginMethod {
  return typeof value === 'string' && KNOWN_LOGIN_METHODS.has(value);
}

/**
 * 画面表示用のログイン方式ラベル(絵文字付き)。未知の値(古いレコード等)は
 * GitHub OAuthと同じ表示にフォールバックする(user_sessions.last_login_methodの
 * デフォルト値もgithub_oauthのため、挙動と表示を一致させる)。
 */
export function loginMethodLabel(method: string | null | undefined): string {
  if (method === LOGIN_METHOD_PUBLIC_KEY) {
    return '🔐 公開鍵(パスキー)';
  }
  return '🐙 GitHub OAuth';
}
