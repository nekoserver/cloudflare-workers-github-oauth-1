import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

// T3を作り直すと署名鍵が変わり、PWAに残った古いセッションは「Invalid session token signature」で拒否され続ける。
// T3が401で拒否したセッションのクッキーだけを、中継(t3-embed-proxy.cjs)が削除して、ペアリング画面へ戻れるようにする。
const require = createRequire(import.meta.url);
const { staleSessionClears, hasCookie, countCookie, isUnauthenticatedSessionBody } = require('../containers/demo/t3-stale-session.cjs');
const { createServer } = require('../containers/demo/t3-embed-proxy.cjs');

describe('staleSessionClears: 削除するかどうかの判定', () => {
  const cookie = 't3_session=old; other=1';
  it('T3が401で拒否し、そのクッキーを送っていたときだけ、削除の指示を返す', () => {
    const clears = staleSessionClears({ status: 401, cookieHeader: cookie, cookieName: 't3_session' });
    expect(clears.length).toBe(2);
    for (const value of clears) {
      expect(value.startsWith('t3_session=;')).toBe(true);
      expect(value).toContain('Max-Age=0');
      expect(value).toContain('Path=/');
      expect(value).toContain('Secure');
    }
    expect(clears.some(value => value.includes('Partitioned'))).toBe(true);
    expect(clears.some(value => !value.includes('Partitioned'))).toBe(true);
  });
  it.each([
    ['認証済み(200)', { status: 200, cookieHeader: cookie, cookieName: 't3_session' }],
    ['403', { status: 403, cookieHeader: cookie, cookieName: 't3_session' }],
    ['クッキーを送っていない', { status: 401, cookieHeader: undefined, cookieName: 't3_session' }],
    ['別名のクッキーだけ', { status: 401, cookieHeader: 'other=1', cookieName: 't3_session' }],
    ['クッキー名が分からない', { status: 401, cookieHeader: cookie, cookieName: null }],
    ['クッキー名が不正', { status: 401, cookieHeader: cookie, cookieName: 'a b;c' }],
  ])('削除しない: %s', (_name, input) => {
    expect(staleSessionClears(input)).toEqual([]);
  });
  it('名前が前方一致するだけの別クッキーは、送っていないものとして扱う', () => {
    expect(hasCookie('t3_session_extra=1', 't3_session')).toBe(false);
    expect(hasCookie('a=1; t3_session=x', 't3_session')).toBe(true);
  });
});

describe('中継: 実際のHTTPで、拒否されたセッションのクッキーを削除する', () => {
  const servers: http.Server[] = [];
  afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve)))); });
  const listen = (server: http.Server) => new Promise<number>(resolve => { servers.push(server); server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)); });
  async function setup(status: number, cookieName: string | null) {
    const upstream = http.createServer((_req, res) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end('{"error":"x"}'); });
    const upstreamPort = await listen(upstream);
    const proxy = createServer({ handle: async () => false }, { upstreamPort, resolveCookieName: async () => cookieName });
    const proxyPort = await listen(proxy);
    return (headers: http.OutgoingHttpHeaders) => new Promise<http.IncomingMessage & { body: string }>((resolve, reject) => {
      http.get({ hostname: '127.0.0.1', port: proxyPort, path: '/api/auth/session', headers }, response => {
        let body = ''; response.on('data', chunk => { body += chunk; });
        response.on('end', () => resolve(Object.assign(response, { body })));
      }).on('error', reject);
    });
  }
  it('401と古いクッキーなら、削除のSet-Cookieを付け、本文はそのまま返す', async () => {
    const get = await setup(401, 't3_session');
    const response = await get({ cookie: 't3_session=old' });
    expect(response.statusCode).toBe(401);
    expect(response.body).toBe('{"error":"x"}');
    const set = response.headers['set-cookie'] ?? [];
    expect(set.length).toBe(2);
    expect(set.every(value => value.startsWith('t3_session=;') && value.includes('Max-Age=0'))).toBe(true);
  });
  it('クッキーが無い401には何も付けない', async () => {
    const get = await setup(401, 't3_session');
    expect((await get({})).headers['set-cookie']).toBeUndefined();
  });
  it('200には何も付けない', async () => {
    const get = await setup(200, 't3_session');
    expect((await get({ cookie: 't3_session=ok' })).headers['set-cookie']).toBeUndefined();
  });
  it('クッキー名が分からなければ何も付けず、401をそのまま返す', async () => {
    const get = await setup(401, null);
    const response = await get({ cookie: 't3_session=old' });
    expect(response.statusCode).toBe(401);
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});

describe('コンテナのイメージ', () => {
  it('プロキシが読み込む t3-stale-session.cjs を、プロキシと同じ場所へコピーする', async () => {
    const { readFileSync } = await import('node:fs');
    const dockerfile = readFileSync(new URL('../containers/demo/Dockerfile', import.meta.url), 'utf8');
    expect(dockerfile).toMatch(/^COPY [^\n]*t3-stale-session\.cjs[^\n]* \/usr\/local\/libexec\/$/m);
    const proxy = readFileSync(new URL('../containers/demo/t3-embed-proxy.cjs', import.meta.url), 'utf8');
    expect(proxy).toContain("require('./t3-stale-session.cjs')");
  });
});

describe('T3は認証に失敗すると、401ではなく200で authenticated:false を返す(T3 0.1.7のソースで確認)', () => {
  const cookie = 't3_session_3773_abc123=old';
  it('200でも、認証されておらず、そのクッキーを送っていたときは削除する', () => {
    const clears = staleSessionClears({ status: 200, unauthenticated: true, cookieHeader: cookie, cookieName: 't3_session_3773_abc123' });
    expect(clears.length).toBe(2);
  });
  it('認証済み(authenticated:true)なら削除しない', () => {
    expect(staleSessionClears({ status: 200, unauthenticated: false, cookieHeader: cookie, cookieName: 't3_session_3773_abc123' })).toEqual([]);
  });
  it('同じ名前のクッキーが複数あっても(Partitioned付きと無しの2つを発行するため)、拒否されたら両方の形を削除する', () => {
    const both = 't3_session_3773_abc123=stale; t3_session_3773_abc123=stale';
    expect(countCookie(both, 't3_session_3773_abc123')).toBe(2);
    const clears = staleSessionClears({ status: 200, unauthenticated: true, cookieHeader: both, cookieName: 't3_session_3773_abc123' });
    expect(clears.length).toBe(2);
    expect(clears.some(value => value.includes('Partitioned'))).toBe(true);
    expect(clears.some(value => !value.includes('Partitioned'))).toBe(true);
  });
  it('クッキーを送っていなければ、認証されていなくても何もしない', () => {
    expect(staleSessionClears({ status: 200, unauthenticated: true, cookieHeader: 'other=1', cookieName: 't3_session_3773_abc123' })).toEqual([]);
  });
  it('応答の本文が authenticated:false かどうかを判定する(壊れた本文・大きすぎる本文は偽)', () => {
    expect(isUnauthenticatedSessionBody('{"authenticated":false,"auth":{}}')).toBe(true);
    expect(isUnauthenticatedSessionBody('{"authenticated":true}')).toBe(false);
    expect(isUnauthenticatedSessionBody('not json')).toBe(false);
    expect(isUnauthenticatedSessionBody('')).toBe(false);
    expect(isUnauthenticatedSessionBody('{"authenticated":false,"pad":"' + 'x'.repeat(70000) + '"}')).toBe(false);
  });
});

describe('中継: /api/auth/session の200 authenticated:false でも、古いクッキーを削除する', () => {
  const servers: http.Server[] = [];
  afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve)))); });
  const listen = (server: http.Server) => new Promise<number>(resolve => { servers.push(server); server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)); });
  async function setup(path: string, status: number, body: string) {
    const upstream = http.createServer((_req, res) => { res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }); res.end(body); });
    const upstreamPort = await listen(upstream);
    const proxy = createServer({ handle: async () => false }, { upstreamPort, resolveCookieName: async () => 't3_session_3773_abc123' });
    const proxyPort = await listen(proxy);
    return (headers: http.OutgoingHttpHeaders) => new Promise<http.IncomingMessage & { body: string }>((resolve, reject) => {
      http.get({ hostname: '127.0.0.1', port: proxyPort, path, headers }, response => {
        let text = ''; response.on('data', chunk => { text += chunk; });
        response.on('end', () => resolve(Object.assign(response, { body: text })));
      }).on('error', reject);
    });
  }
  const unauth = '{"authenticated":false,"auth":{"sessionCookieName":"t3_session_3773_abc123"}}';
  it('200 authenticated:false とクッキー: 削除を付け、本文はそのまま返す', async () => {
    const response = await (await setup('/api/auth/session', 200, unauth))({ cookie: 't3_session_3773_abc123=old' });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(unauth);
    expect((response.headers['set-cookie'] ?? []).length).toBe(2);
  });
  it('重複したクッキー: 両方の形を削除する', async () => {
    const response = await (await setup('/api/auth/session', 200, unauth))({ cookie: 't3_session_3773_abc123=old; t3_session_3773_abc123=old' });
    const set = response.headers['set-cookie'] ?? [];
    expect(set.length).toBe(2);
    expect(response.body).toBe(unauth);
  });
  it('200 authenticated:true: 何も付けない', async () => {
    const body = '{"authenticated":true}';
    const response = await (await setup('/api/auth/session', 200, body))({ cookie: 't3_session_3773_abc123=ok' });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.body).toBe(body);
  });
  it('別のパスの200 authenticated:false は触らない', async () => {
    const response = await (await setup('/api/other', 200, unauth))({ cookie: 't3_session_3773_abc123=old' });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.body).toBe(unauth);
  });
  it('JSONでない本文は、そのまま通し、何も付けない', async () => {
    const response = await (await setup('/api/auth/session', 200, 'not json'))({ cookie: 't3_session_3773_abc123=old' });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('not json');
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
