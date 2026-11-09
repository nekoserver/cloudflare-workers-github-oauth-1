import { describe, it, expect, vi } from 'vitest';
import { createHeritageProxyRoutes } from './heritageProxy';

const authenticated = async (c: any, next: () => Promise<void>) => { c.set('user', { sub: 'alice', github_access_token: 'secret' }); await next(); };
const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;

describe('heritage Worker forwarding', () => {
  it('passes method, URL, credentials and POST body to the separate Worker', async () => {
    const app = createHeritageProxyRoutes(authenticated);
    const fetch = vi.fn(async (request: Request) => {
      expect(request.method).toBe('POST');
      expect(request.url).toBe('https://example.com/api/heritage-cities?x=1');
      expect(request.headers.get('Cookie')).toBe('auth_token=abc');
      expect(await request.json()).toEqual({ name: 'Kyoto' });
      return new Response('saved', { status: 201, headers: { 'Set-Cookie': 'last_activity=1' } });
    });
    const res = await app.fetch(new Request('https://example.com/api/heritage-cities?x=1', { method: 'POST', headers: { Cookie: 'auth_token=abc' }, body: JSON.stringify({ name: 'Kyoto' }) }), { HERITAGE: { fetch } } as never, ctx);
    expect(res.status).toBe(201);
    expect(await res.text()).toBe('saved');
    expect(res.headers.get('Set-Cookie')).toBe('last_activity=1');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('returns only authenticated identity from the auth endpoint', async () => {
    const res = await createHeritageProxyRoutes(authenticated).fetch(new Request('https://example.com/api/heritage/auth-context'), {} as never, ctx);
    expect(await res.json()).toEqual({ user: { sub: 'alice' } });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('fails without a binding, and does not retry failed writes', async () => {
    const app = createHeritageProxyRoutes(authenticated);
    expect((await app.fetch(new Request('https://example.com/heritage-journey'), {} as never, ctx)).status).toBe(503);
    const fetch = vi.fn(async () => { throw new Error('unavailable'); });
    expect((await app.fetch(new Request('https://example.com/api/heritage-area-boxes', { method: 'POST', body: '{}' }), { HERITAGE: { fetch } } as never, ctx)).status).toBe(503);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not forward unrelated APIs or unsupported methods', async () => {
    const app = createHeritageProxyRoutes(authenticated);
    const fetch = vi.fn();
    for (const [path, method] of [['/api/aichat', 'POST'], ['/api/heritage-cities-extra', 'GET'], ['/heritage-journey', 'POST']]) {
      expect((await app.fetch(new Request('https://example.com' + path, { method }), { HERITAGE: { fetch } } as never, ctx)).status).toBe(404);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
