import type { Context } from 'hono';
import type { Bindings, Variables } from '../types';

const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
export async function redmineSignature(secret: string, method: string, path: string, timestamp: string, nonce: string, apiKey: string, contentType: string, body: ArrayBuffer) {
  const digest = async (value: ArrayBuffer) => hex(await crypto.subtle.digest('SHA-256', value));
  const canonical = ['redmine-v1', method, path, timestamp, nonce, await digest(encoder.encode(apiKey).buffer), await digest(encoder.encode(contentType).buffer), await digest(body)].join('\n');
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(canonical)));
}

export function allowedRedminePath(method: string, path: string): boolean {
  if (/[\r\n\\#]/.test(path)) return false;
  const pathname = path.split('?')[0];
  let decoded: string;
  try { decoded = decodeURIComponent(pathname); } catch { return false; }
  if (/[\r\n\\%#?]/.test(decoded) || decoded.split('/').some(part => part === '.' || part === '..')) return false;
  if (method === 'GET') return /^(projects|issue_statuses|enumerations\/issue_priorities|trackers|issues)\.json$/.test(pathname)
    || /^projects\/[1-9]\d*\/memberships\.json$/.test(pathname)
    || /^issues\/[1-9]\d*\.json$/.test(pathname)
    || /^attachments\/download\/[1-9]\d*(\/[^/]+)?$/.test(pathname) && /^attachments\/download\/[1-9]\d*(\/[^/]+)?$/.test(decoded);
  if (method === 'POST') return pathname === 'issues.json' || pathname === 'uploads.json';
  return method === 'PUT' && /^issues\/[1-9]\d*\.json$/.test(pathname);
}

export async function proxyRedmine(c: Context<{ Bindings: Bindings; Variables: Variables }>): Promise<Response> {
  const error = (message: string, status: 400 | 403 | 413 | 502 | 503) => c.json({ errors: [message] }, status, { 'Cache-Control': 'no-store' });
  if (!c.env.REDMINE_HMAC_SECRET || !c.env.REDMINE_HMAC_TARGETS) return error('Redmine HMAC接続がWorkerに設定されていません。', 503);
  const origin = c.req.header('Origin');
  if ((origin && origin !== new URL(c.req.url).origin) || (c.req.method !== 'GET' && !origin)) return error('同じオリジンから操作してください。', 403);
  const base = c.req.query('base') || '', path = c.req.query('path') || '';
  let gateway: URL;
  try {
    const targets = JSON.parse(c.env.REDMINE_HMAC_TARGETS) as Record<string, string>;
    const target = Object.prototype.hasOwnProperty.call(targets, base) ? targets[base] : undefined;
    if (typeof target !== 'string') return error('このRedmine URLはWorkerの接続先に登録されていません。', 403);
    gateway = new URL(target);
    if (gateway.protocol !== 'https:' || gateway.username || gateway.password || gateway.search || gateway.hash) throw new Error();
  } catch { return error('Redmine接続先のWorker設定が不正です。', 503); }
  if (!allowedRedminePath(c.req.method, path)) return error('許可されていないRedmine APIです。', 400);
  const apiKey = c.req.header('X-Redmine-API-Key') || '';
  if (!apiKey || apiKey.length > 512) return error('Redmine APIキーが必要です。', 400);
  const limit = 10 * 1024 * 1024;
  const chunks: Uint8Array[] = []; let size = 0;
  const reader = c.req.raw.body?.getReader();
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); return error('リクエストは10MiB以下にしてください。', 413); }
      chunks.push(value);
    }
  }
  const body = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  const contentType = c.req.method === 'GET' ? '' : c.req.header('Content-Type') || 'application/json';
  if (contentType && !['application/json', 'application/octet-stream'].includes(contentType)) return error('未対応のContent-Typeです。', 400);
  const timestamp = String(Math.floor(Date.now() / 1000)), nonce = crypto.randomUUID();
  const signature = await redmineSignature(c.env.REDMINE_HMAC_SECRET, c.req.method, path, timestamp, nonce, apiKey, contentType, body.buffer);
  gateway.searchParams.set('path', path);
  try {
    const response = await fetch(gateway, { method: c.req.method, redirect: 'error', signal: AbortSignal.timeout(30000), headers: {
      'X-Redmine-API-Key': apiKey, 'X-Redmine-Timestamp': timestamp, 'X-Redmine-Nonce': nonce,
      'X-Redmine-Signature': signature, ...(contentType ? { 'Content-Type': contentType } : {}),
    }, body: c.req.method === 'GET' ? undefined : body });
    return new Response(response.body, { status: response.status, headers: {
      'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch { return error('ApacheのHMACゲートウェイに接続できません。URL・TLS・ネットワーク設定を確認してください。', 502); }
}
