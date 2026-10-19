import type { Context } from 'hono';
import type { Bindings, Variables } from '../types';

const ORIGIN = 'https://mygw.nekomaneki.work';
const SIGNER = 'https://internal/tunnel-signer/send';
const ASSETS: Record<string, string> = {
  '/cf-containers/docker.html': '/lib/docker.html',
  '/cf-containers/docker-dashboard.css': '/lib/docker-dashboard.css',
  '/cf-containers/docker-dashboard.mjs': '/lib/docker-dashboard.mjs',
};
type DockerContext = Context<{ Bindings: Bindings; Variables: Variables }>;
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

/** Call only behind authMiddleware + cfDashboardAdminMiddleware. Fixed targets only. */
export async function proxyDockerDashboard(c: DockerContext): Promise<Response> {
  const error = (message: string, status = 502) => Response.json({ error: message }, { status, headers });
  const url = new URL(c.req.url);
  if (url.search) return error('query_not_allowed', 400);
  const origin = c.req.header('Origin');
  if ((origin && origin !== url.origin) || (c.req.method !== 'GET' && origin !== url.origin)) {
    return error('origin_rejected', 403);
  }
  const asset = ASSETS[url.pathname];
  if (asset) {
    if (c.req.method !== 'GET') return error('method_not_allowed', 405);
    try {
      const upstream = await fetch(ORIGIN + asset, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
      if (upstream.status !== 200) { await upstream.body?.cancel(); return error('dashboard_asset_unavailable'); }
      const contentType = asset.endsWith('.html') ? 'text/html; charset=utf-8'
        : asset.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8';
      const responseHeaders = { ...headers, 'Content-Type': contentType };
      if (asset.endsWith('.html')) {
        const html = await upstream.text();
        // The browser uses Worker admin authentication; never give it the HMAC secret.
        return new Response(html.replace('<head>', '<head><meta name="docker-auth-mode" content="worker">'), { headers: responseHeaders });
      }
      return new Response(upstream.body, { headers: responseHeaders });
    } catch { return error('dashboard_asset_unavailable'); }
  }
  const action = url.pathname.slice('/cf-containers/api/docker/'.length);
  const allowed = (action === 'session' && c.req.method === 'GET')
    || (action === 'catalog' && c.req.method === 'GET')
    || (action === 'run' && c.req.method === 'POST');
  if (!url.pathname.startsWith('/cf-containers/api/docker/') || !allowed) return error('not_found', 404);
  if (!c.env.RUST_WORKER) return error('署名代行のRUST_WORKERが設定されていません。', 503);
  if (action === 'session') return Response.json({ authenticated: true, auth_mode: 'worker' }, { headers });
  let body = '{}';
  if (action === 'run') {
    // Read incrementally to enforce the limit even with no Content-Length header.
    const reader = c.req.raw.body?.getReader();
    const chunks: Uint8Array[] = []; let length = 0;
    if (reader) {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > 4096) { await reader.cancel(); return error('request_too_large', 413); }
        chunks.push(part.value);
      }
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try {
      const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (!data || typeof data !== 'object' || Array.isArray(data)) return error('invalid_request', 400);
      const value = data as Record<string, unknown>;
      if (typeof value.command !== 'string' || !/^[a-z_]{1,64}$/.test(value.command)) return error('invalid_command', 400);
      if (value.target !== undefined && (typeof value.target !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/.test(value.target))) return error('invalid_target', 400);
      // Ignore incoming URLs, headers, cookies and other untrusted properties.
      body = JSON.stringify({ command: value.command, ...(value.target !== undefined ? { target: value.target } : {}) });
    } catch { return error('invalid_request', 400); }
  }
  try {
    const response = await c.env.RUST_WORKER.fetch(SIGNER, {
      method: 'POST', signal: AbortSignal.timeout(35000), headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: ORIGIN + '/lib/api/docker/worker/' + action, contentType: 'application/json', body }),
    });
    if (!response.ok) { await response.body?.cancel(); return error('署名代行に接続できませんでした。'); }
    const result = await response.json<{ ok?: boolean; status?: number; body?: string; error?: string }>();
    if (result.error || typeof result.body !== 'string' || !Number.isInteger(result.status)
      || result.status! < 200 || result.status! > 599 || result.body.length > 8 * 1024 * 1024) return error('署名代行の応答が不正です。');
    if (!result.ok) return error('Docker APIの認証または接続に失敗しました。', result.status === 401 ? 502 : result.status!);
    JSON.parse(result.body);
    return new Response(result.body, { status: result.status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
  } catch { return error('Docker APIの応答を取得できませんでした。'); }
}
