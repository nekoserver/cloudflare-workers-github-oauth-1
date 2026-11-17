// SPEC.cloudflare-workers-github-oauth-1.lib-proxy-identity REQ-LP-001。
// /cf-containers/proxy/* の中継リクエストを組み立てる。
// ブラウザ由来の X-Forwarded-User は身元の証拠にならないため必ず削除し、
// ワーカーの認証済みセッションのログイン名(user.sub = GitHubログイン名)を付け直す。
// ログインが取れない場合は削除だけを行い、付けない(「身元なし」に落とす)。

export const PROXY_USER_HEADER = 'x-forwarded-user';

export function buildProxyForwardRequest(raw: Request, forwardUrl: string, login: string | null): Request {
  const request = new Request(forwardUrl, raw);
  request.headers.delete(PROXY_USER_HEADER);
  const value = login?.trim();
  if (value) request.headers.set(PROXY_USER_HEADER, value);
  return request;
}
