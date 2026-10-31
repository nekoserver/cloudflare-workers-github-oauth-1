import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomBytes } from 'node:crypto';

// 承認ボタンを押させない。ログイン済みのブラウザ(T3の /api/auth/session が authenticated:true)と
// 同じ接続元IPから、5分以内にPWAが申請したら、中継が自動で承認してペアリングの資格情報を用意する。
const require = createRequire(import.meta.url);
const { createPwaAuth, createServer } = { ...require('../containers/demo/t3-pwa-auth.cjs'), ...require('../containers/demo/t3-embed-proxy.cjs') };

const ORIGIN = 'https://t3.example.test';
const servers: http.Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve)))); });
const listen = (server: http.Server) => new Promise<number>(resolve => { servers.push(server); server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)); });

async function setup() {
  let clock = 1_800_000_000;
  const mintAutoPairing = vi.fn(async (label: string) => ({ credential: 'AUTO2345EFGH', expiresAt: new Date((clock + 300) * 1000).toISOString(), label }));
  const pwa = createPwaAuth({
    dbPath: ':memory:', origin: ORIGIN, key: randomBytes(32), now: () => clock,
    readConfig: () => ({ enabled: true, developmentOnly: true, generation: 'g1' }), generation: () => 'gen1',
    verifySession: async () => ({ authenticated: false }), mintPairing: vi.fn(), mintAutoPairing,
  });
  // 偽のT3: クッキーがあればログイン済み、無ければ未ログインを返す。
  const t3 = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(req.headers.cookie ? { authenticated: true, sessionMethod: 'browser-session-cookie' } : { authenticated: false }));
  });
  const upstreamPort = await listen(t3);
  const proxyPort = await listen(createServer(pwa, { upstreamPort, resolveCookieName: async () => 't3_session' }));
  const call = (method: string, path: string, ip: string, data?: unknown, headers: Record<string, string> = {}) => new Promise<{ status: number; json: any }>((resolve, reject) => {
    const body = data === undefined ? '' : JSON.stringify(data);
    const request = http.request({ hostname: '127.0.0.1', port: proxyPort, method, path, headers: { origin: ORIGIN, 'cf-connecting-ip': ip, 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), ...headers } }, response => {
      let text = ''; response.on('data', c => { text += c; }); response.on('end', () => { let json: any = null; try { json = JSON.parse(text); } catch {} resolve({ status: response.statusCode ?? 0, json }); });
    });
    request.on('error', reject); request.end(body);
  });
  const browserSeen = (ip: string) => call('GET', '/api/auth/session', ip, undefined, { cookie: 't3_session=ok' });
  return { call, browserSeen, mintAutoPairing, advance: (s: number) => { clock += s; } };
}

describe('PWAの自動承認(同じ接続元・5分以内)', () => {
  it('ログイン済みのブラウザと同じIPからの申請は、操作なしで承認され、受け取れる', async () => {
    const s = await setup();
    await s.browserSeen('203.0.113.7');
    const secret = randomBytes(32).toString('hex');
    const created = await s.call('POST', '/_t3/pwa/create', '203.0.113.7', { secret });
    expect(created.status).toBe(201);
    const status = await s.call('POST', '/_t3/pwa/status', '203.0.113.7', { id: created.json.id, secret });
    expect(status.json.state).toBe('approved');
    expect(s.mintAutoPairing).toHaveBeenCalledWith('tree-view-pwa:' + created.json.id);
    const claim = await s.call('POST', '/_t3/pwa/claim', '203.0.113.7', { id: created.json.id, secret });
    expect(claim.json).toEqual({ credential: 'AUTO2345EFGH' });
  });
  it('別のIPからの申請は自動で承認しない', async () => {
    const s = await setup();
    await s.browserSeen('203.0.113.7');
    const secret = randomBytes(32).toString('hex');
    const created = await s.call('POST', '/_t3/pwa/create', '198.51.100.9', { secret });
    expect((await s.call('POST', '/_t3/pwa/status', '198.51.100.9', { id: created.json.id, secret })).json.state).toBe('pending');
    expect(s.mintAutoPairing).not.toHaveBeenCalled();
  });
  it('ブラウザのログインを最後に見てから5分を過ぎた申請は自動で承認しない', async () => {
    const s = await setup();
    await s.browserSeen('203.0.113.7');
    s.advance(301);
    const secret = randomBytes(32).toString('hex');
    const created = await s.call('POST', '/_t3/pwa/create', '203.0.113.7', { secret });
    expect((await s.call('POST', '/_t3/pwa/status', '203.0.113.7', { id: created.json.id, secret })).json.state).toBe('pending');
  });
  it('未ログインのブラウザ(authenticated:false)は数えない', async () => {
    const s = await setup();
    await s.call('GET', '/api/auth/session', '203.0.113.7');
    const secret = randomBytes(32).toString('hex');
    const created = await s.call('POST', '/_t3/pwa/create', '203.0.113.7', { secret });
    expect((await s.call('POST', '/_t3/pwa/status', '203.0.113.7', { id: created.json.id, secret })).json.state).toBe('pending');
  });
  it('自動の発行に失敗したら、申請は承認待ちのまま残る(手動の承認で進める)', async () => {
    const s = await setup();
    s.mintAutoPairing.mockRejectedValueOnce(new Error('t3 not running'));
    await s.browserSeen('203.0.113.7');
    const secret = randomBytes(32).toString('hex');
    const created = await s.call('POST', '/_t3/pwa/create', '203.0.113.7', { secret });
    expect(created.status).toBe(201);
    expect(created.json.autoApproval).toEqual({ ok: false, detail: 't3 not running' });
    expect((await s.call('POST', '/_t3/pwa/status', '203.0.113.7', { id: created.json.id, secret })).json.state).toBe('pending');
  });
});
