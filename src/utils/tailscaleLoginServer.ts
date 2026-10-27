/**
 * 対象: /cf-containersの管理画面からTAILSCALE_LOGIN_SERVER(tailscale upの
 * --login-serverに渡す管理サーバーURL)を保存する前の入力検証。
 *
 * 認証キーをhttpで送らないようhttpsのみ許可し、URLに認証情報(user:pass@)を
 * 含むものは拒否する。失敗は文字列prefixではなくerrorCodeで表現する。
 */
export type TailscaleLoginServerResult =
  | { ok: true; value: string }
  | { ok: false; errorCode: 'EMPTY' | 'INVALID_URL' | 'NOT_HTTPS' | 'HAS_CREDENTIALS'; error: string };

export function validateTailscaleLoginServer(input: string): TailscaleLoginServerResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, errorCode: 'EMPTY', error: 'TAILSCALE_LOGIN_SERVERが空です' };
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, errorCode: 'INVALID_URL', error: 'TAILSCALE_LOGIN_SERVERはURLとして解釈できません' };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, errorCode: 'NOT_HTTPS', error: 'TAILSCALE_LOGIN_SERVERはhttps://で始まる必要があります' };
  }
  if (url.username || url.password) {
    return { ok: false, errorCode: 'HAS_CREDENTIALS', error: 'TAILSCALE_LOGIN_SERVERに認証情報(user:pass@)は含められません' };
  }
  return { ok: true, value: trimmed.replace(/\/+$/, '') };
}
