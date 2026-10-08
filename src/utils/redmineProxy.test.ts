import { afterEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { allowedRedminePath, proxyRedmine, redmineSignature } from './redmineProxy';
const env = { REDMINE_HMAC_SECRET: 'test-secret-with-at-least-32-chars', REDMINE_HMAC_TARGETS: JSON.stringify({'https://redmine.example/redmine':'https://redmine.example/redmine-hmac'}) };
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
app.all('/api/taskmine/redmine', proxyRedmine);
const url = (path = 'projects.json') => 'https://worker.example/api/taskmine/redmine?' + new URLSearchParams({base:'https://redmine.example/redmine', path});
afterEach(() => vi.unstubAllGlobals());
describe('Redmine HMAC proxy', () => {
  it('signs a fixed cross-language vector and binds body, API key and method', async () => {
    const body = new TextEncoder().encode('{"issue":{"subject":"日本語"}}').buffer;
    const args = ['test-secret-with-at-least-32-chars','POST','issues.json','1791475200','12345678-1234-1234-1234-123456789abc','api-key','application/json',body] as const;
    const signature = await redmineSignature(...args);
    expect(signature).toBe('8ec0ed783c95d470e079a1d2d6a40afbc9579023f6426881aca5d9c046386cae');
    expect(await redmineSignature(args[0], 'PUT', ...args.slice(2) as [string,string,string,string,string,ArrayBuffer])).not.toBe(signature);
    expect(await redmineSignature(...args.slice(0,5) as [string,string,string,string,string], 'other-key', args[6], body)).not.toBe(signature);
  });
  it('forwards only a configured target, signs it, and drops upstream cookies', async () => {
    const fetcher = vi.fn(async (_url: URL, init: RequestInit) => {
      if (init.redirect === 'error') throw new TypeError('Invalid redirect value, must be follow or manual');
      return new Response('{"projects":[]}', {headers:{'Content-Type':'application/json','Set-Cookie':'secret=upstream'}});
    });
    vi.stubGlobal('fetch', fetcher);
    const response = await app.request(url(), {headers:{'X-Redmine-API-Key':'api-key'}}, env);
    expect(response.status).toBe(200);
    const [target, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(target.origin + target.pathname).toBe('https://redmine.example/redmine-hmac');
    const headers = init.headers as Record<string,string>;
    expect(headers['X-Redmine-Signature']).toBe(await redmineSignature(env.REDMINE_HMAC_SECRET, 'GET', 'projects.json', headers['X-Redmine-Timestamp'], headers['X-Redmine-Nonce'], 'api-key', '', new ArrayBuffer(0)));
    expect(init.redirect).toBe('manual');
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it.each([301, 302, 303, 307, 308])('refuses HTTP %s redirects without following or exposing their Location', async status => {
    const fetcher = vi.fn(async () => new Response('login', {status,headers:{Location:'https://other.example/login'}}));
    vi.stubGlobal('fetch', fetcher);
    const response = await app.request(url(), {headers:{'X-Redmine-API-Key':'key'}}, env);
    expect(response.status).toBe(502);
    expect(response.headers.get('Location')).toBeNull();
    expect(await response.text()).toContain('リダイレクト');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects unconfigured destinations and cross-origin writes before fetching', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect((await app.request(url().replace('redmine.example%2Fredmine','other.example%2Fredmine'), {headers:{'X-Redmine-API-Key':'key'}}, env)).status).toBe(403);
    expect((await app.request(url('issues.json'), {method:'POST',headers:{Origin:'https://evil.example','X-Redmine-API-Key':'key'},body:'{}'}, env)).status).toBe(403);
    expect((await app.request(url('issues.json'), {method:'POST',headers:{'X-Redmine-API-Key':'key'},body:'{}'}, env)).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(['../projects.json','https://evil.example','issues/1.json/../users.json','attachments/download/1/%2e%2e','projects.json#fragment'])('rejects path escape %s', path => {
    expect(allowedRedminePath('GET', path)).toBe(false);
  });
  it('allows encoded attachment filenames while refusing encoded path separators', () => {
    expect(allowedRedminePath('GET', 'attachments/download/7/%E6%97%A5%E6%9C%AC%E8%AA%9E.txt')).toBe(true);
    expect(allowedRedminePath('GET', 'attachments/download/7/x%2f..%2fusers.json')).toBe(false);
  });
  it('signs writes from the same origin including exact upload bytes', async () => {
    const fetcher = vi.fn(async () => new Response(null, {status:204}));
    vi.stubGlobal('fetch', fetcher);
    const body = new Uint8Array([0, 255, 42]);
    const response = await app.request(url('uploads.json?filename=test.bin'), {method:'POST', headers:{Origin:'https://worker.example','X-Redmine-API-Key':'key','Content-Type':'application/octet-stream'}, body}, env);
    expect(response.status).toBe(204);
    const init = (fetcher.mock.calls[0] as unknown as [URL, RequestInit])[1];
    expect(Array.from(init.body as Uint8Array)).toEqual([0,255,42]);
    const headers = init.headers as Record<string,string>;
    expect(headers['X-Redmine-Signature']).toBe(await redmineSignature(env.REDMINE_HMAC_SECRET, 'POST', 'uploads.json?filename=test.bin', headers['X-Redmine-Timestamp'], headers['X-Redmine-Nonce'], 'key', 'application/octet-stream', body.buffer));
  });
  it('fails closed when not configured and exposes no network exception details', async () => {
    expect((await app.request(url(), {}, {})).status).toBe(503);
    vi.stubGlobal('fetch', vi.fn(async () => {throw new Error('api-key leaked');}));
    const res = await app.request(url(), {headers:{'X-Redmine-API-Key':'key'}}, env);
    expect(res.status).toBe(502); expect(await res.text()).not.toContain('api-key leaked');
  });
});


it('allows reading only the authenticated Redmine user, not arbitrary users', () => {
  expect(allowedRedminePath('GET', 'users/current.json')).toBe(true);
  expect(allowedRedminePath('GET', 'users.json')).toBe(false);
  expect(allowedRedminePath('GET', 'users/1.json')).toBe(false);
  expect(allowedRedminePath('PUT', 'users/current.json')).toBe(false);
});
