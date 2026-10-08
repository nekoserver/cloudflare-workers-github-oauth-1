/** Authenticated, non-persistent relay for the explicitly permitted Redmine server. */
export const TASKMINE_REDMINE_ORIGIN = 'https://mynw.nekomaneki.work';

type RedmineFetch = (url: string, init: RequestInit) => Promise<Response>;

export function validateTaskmineRedmineTarget(base: string, path: string, method: string): URL {
  const url = new URL(base);
  if (url.origin !== TASKMINE_REDMINE_ORIGIN || url.username || url.password || url.search || url.hash) {
    throw new Error('接続できるRedmineは ' + TASKMINE_REDMINE_ORIGIN + ' です。');
  }
  if (path.length > 8192 || path.includes('\\') || path.includes('#')) {
    throw new Error('Redmine APIのパスが不正です。');
  }
  const [pathname, query = ''] = path.split('?');
  if (path.split('?').length > 2 || pathname.split('/').some(segment => {
    const decoded = decodeURIComponent(segment);
    return decoded === '.' || decoded === '..' || decoded.includes('/') || decoded.includes('\\');
  })) {
    throw new Error('Redmine APIのパスが不正です。');
  }
  const read = /^(users\/current|projects|issue_statuses|enumerations\/issue_priorities|trackers|issues|issues\/[1-9]\d*|projects\/[1-9]\d*\/memberships)\.json$/;
  const download = /^attachments\/download\/[1-9]\d*\/[^/]+$/;
  const allowed = method === 'GET' ? read.test(pathname) || download.test(pathname)
    : method === 'POST' ? ['issues.json', 'uploads.json'].includes(pathname)
      : method === 'PUT' && /^issues\/[1-9]\d*\.json$/.test(pathname);
  const queryKeys = new Set(['limit', 'offset', 'status_id', 'sort', 'project_id', 'assigned_to_id', 'priority_id', 'include', 'filename', 'issue_id']);
  if (!allowed || Array.from(new URLSearchParams(query).keys()).some(key => !queryKeys.has(key))) {
    throw new Error('このRedmine API操作には対応していません。');
  }
  url.pathname = url.pathname.replace(/\/$/, '') + '/' + pathname;
  url.search = query;
  return url;
}

function errorResponse(error: string, errorCode: string, status: number): Response {
  return Response.json({ error, errorCode }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Credentials are used for this request only; never written to storage or logs. */
export async function forwardTaskmineRedmine(request: Request, fetcher: RedmineFetch = fetch): Promise<Response> {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) {
    return errorResponse('同じサイトから接続してください。', 'TASKMINE_ORIGIN', 403);
  }
  const key = request.headers.get('X-Redmine-API-Key')?.trim();
  if (!key || key.length > 512) return errorResponse('RedmineのAPIキーを入力してください。', 'REDMINE_KEY', 400);
  const path = request.headers.get('X-Redmine-Path') || '';
  const method = request.headers.get('X-Redmine-Method') || 'GET';
  let target: URL;
  try {
    target = validateTaskmineRedmineTarget(request.headers.get('X-Redmine-URL') || '', path, method);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'RedmineのURLが不正です。', 'REDMINE_TARGET', 400);
  }
  const type = request.headers.get('Content-Type')?.split(';')[0].trim() || 'application/json';
  if (method !== 'GET' && type !== (path.startsWith('uploads.json') ? 'application/octet-stream' : 'application/json')) {
    return errorResponse('送信データの形式が不正です。', 'REDMINE_CONTENT_TYPE', 400);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetcher(target.href, {
      method, redirect: 'manual', signal: controller.signal,
      headers: { 'X-Redmine-API-Key': key, Accept: 'application/json', 'Content-Type': type },
      body: method === 'GET' ? undefined : request.body,
    });
    if (response.status >= 300 && response.status < 400) {
      return errorResponse('Redmineが別のURLへ転送しました。ログインページではなくRedmine本体のURLを入力してください。', 'REDMINE_REDIRECT', 502);
    }
    if (response.status === 401) return errorResponse('Redmineの認証に失敗しました。マイアカウントのAPIキーと、REST APIの有効化を確認してください。', 'REDMINE_AUTH', 401);
    if (response.status === 403) return errorResponse('Redmineがアクセスを拒否しました。REST API設定・ユーザー権限・接続元のアクセス制限を確認してください。', 'REDMINE_FORBIDDEN', 403);
    if (response.status === 404) return errorResponse('RedmineのAPIが見つかりません。Redmine本体のURLとREST API設定を確認してください。', 'REDMINE_NOT_FOUND', 404);
    if (response.status === 204) return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    if (path.startsWith('attachments/download/') && response.ok) {
      return new Response(response.body, { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    }
    if (!response.headers.get('Content-Type')?.includes('application/json')) {
      return errorResponse('RedmineがJSONではなくページを返しました。Redmine本体のURLとREST API設定を確認してください。', 'REDMINE_FORMAT', 502);
    }
    return new Response(response.body, { status: response.status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return errorResponse('WorkerからRedmineに接続できません。サーバーの稼働状況・TLS証明書・アクセス制限を確認してください。', 'REDMINE_NETWORK', 502);
  } finally {
    clearTimeout(timer);
  }
}
