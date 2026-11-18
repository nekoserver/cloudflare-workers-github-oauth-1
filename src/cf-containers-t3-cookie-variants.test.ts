import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

// iOSのSafariは、Partitioned付きのクッキーを拒否する場合がある(Safari 18.5のWebKitの不具合報告)。
// iframeに埋め込むかどうかは要求から見分けられないため、T3が発行したクッキー1つにつき、
// 同じ値で「Partitioned付き」と「無し」の2つを返す。どちらにもSecure・HttpOnly・SameSite=Noneを付ける(ルール25)。
const require = createRequire(import.meta.url);
const { rewriteSetCookies } = require('../containers/demo/t3-stale-session.cjs');
const { createServer } = require('../containers/demo/t3-embed-proxy.cjs');

const T3_COOKIE = 't3_session_3773_abc=token123; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000';

describe('rewriteSetCookies: T3のクッキーを2つの形で返す', () => {
  const out = rewriteSetCookies([T3_COOKIE]);
  it('1つのクッキーから、同じ値で2つを返す', () => {
    expect(out.length).toBe(2);
    expect(out.every((value: string) => value.startsWith('t3_session_3773_abc=token123;'))).toBe(true);
  });
  it('1つはPartitioned付き、もう1つは無し', () => {
    expect(out.filter((value: string) => /;\s*Partitioned\b/i.test(value)).length).toBe(1);
  });
  it('両方に Secure・HttpOnly・SameSite=None があり、SameSiteは1つだけ', () => {
    for (const value of out) {
      expect(value).toMatch(/;\s*Secure\b/);
      expect(value).toMatch(/;\s*HttpOnly\b/);
      expect(value.match(/SameSite=/gi)?.length).toBe(1);
      expect(value).toContain('SameSite=None');
    }
  });
  it('T3が元から付けていた属性(Max-Age・Path)は残す', () => {
    for (const value of out) { expect(value).toContain('Max-Age=2592000'); expect(value).toContain('Path=/'); }
  });
  it('元からPartitionedやSecureが付いていても、重ならない', () => {
    const twice = rewriteSetCookies([T3_COOKIE + '; Secure; Partitioned']);
    for (const value of twice) { expect(value.match(/Secure/g)?.length).toBe(1); expect((value.match(/Partitioned/g) ?? []).length).toBeLessThanOrEqual(1); }
  });
  it('複数のクッキーは、それぞれ2つずつになる', () => {
    expect(rewriteSetCookies([T3_COOKIE, 'other=1; Path=/']).length).toBe(4);
  });
  it('クッキーが無ければ空のまま', () => {
    expect(rewriteSetCookies([])).toEqual([]);
  });
});

describe('中継: トークン交換の応答で、2つの形のクッキーを返す(実際のHTTP)', () => {
  const servers: http.Server[] = [];
  afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve)))); });
  const listen = (server: http.Server) => new Promise<number>(resolve => { servers.push(server); server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)); });
  it('POST /api/auth/browser-session の Set-Cookie が、Partitioned付きと無しの2つになる', async () => {
    const upstream = http.createServer((_req, res) => { res.writeHead(200, { 'content-type': 'application/json', 'set-cookie': [T3_COOKIE] }); res.end('{"authenticated":true}'); });
    const upstreamPort = await listen(upstream);
    const proxyPort = await listen(createServer({ handle: async () => false }, { upstreamPort, resolveCookieName: async () => 't3_session_3773_abc' }));
    const set = await new Promise<string[]>((resolve, reject) => {
      const request = http.request({ hostname: '127.0.0.1', port: proxyPort, method: 'POST', path: '/api/auth/browser-session', headers: { 'content-type': 'application/json' } }, response => { response.resume(); response.on('end', () => resolve(response.headers['set-cookie'] ?? [])); });
      request.on('error', reject); request.end('{"credential":"pair"}');
    });
    expect(set.length).toBe(2);
    expect(set.filter(value => value.includes('Partitioned')).length).toBe(1);
    expect(set.every(value => value.includes('Secure') && value.includes('HttpOnly') && value.includes('SameSite=None'))).toBe(true);
  });
});
