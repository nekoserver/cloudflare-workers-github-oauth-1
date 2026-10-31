import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomBytes } from 'node:crypto';

// ブラウザでログイン済みのT3のセッションを、iOSのPWAへ引き継ぐ。
// PWAが申請 -> ログイン済みのブラウザで承認 -> 承認したセッションでT3本来のペアリングの資格情報を発行(POST /api/auth/pairing-token)
// -> PWAが受け取り、PWAの中でT3本来のペアリングをする。CLIのBearerセッションや通信の差し替えは使わない。
const require = createRequire(import.meta.url);
const { createPwaAuth } = require('../containers/demo/t3-pwa-auth.cjs');

const ORIGIN = 'https://t3.example.test';
const COOKIE = 't3_session_3773_abc=browser-session';
const OWNER = { authenticated: true, sessionMethod: 'browser-session-cookie', scopes: ['access:write', 'orchestration:read', 'orchestration:operate'], auth: { sessionCookieName: 't3_session_3773_abc' } };

const servers: http.Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve)))); });

async function setup(over: Record<string, unknown> = {}) {
  let clock = 1_800_000_000;
  const mintPairing = vi.fn(async (cookie: string, label: string) => ({ id: 'pl-1', credential: 'ABCD2345EFGH', expiresAt: new Date((clock + 300) * 1000).toISOString(), cookie, label }));
  const pwa = createPwaAuth({
    dbPath: ':memory:', origin: ORIGIN, key: randomBytes(32), now: () => clock,
    readConfig: () => ({ enabled: true, developmentOnly: true, generation: 'g1' }),
    generation: () => 'gen1',
    verifySession: async ({ cookie }: { cookie?: string }) => (cookie && cookie.includes(COOKIE) ? OWNER : { authenticated: false }),
    mintPairing,
    ...over,
  });
  const server = http.createServer(async (req, res) => { if (!(await pwa.handle(req, res))) { res.writeHead(404); res.end(); } });
  const port = await new Promise<number>(resolve => { servers.push(server); server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)); });
  const call = (method: string, path: string, data?: unknown, headers: Record<string, string> = {}) => new Promise<{ status: number; json: any }>((resolve, reject) => {
    const body = data === undefined ? '' : JSON.stringify(data);
    const request = http.request({ hostname: '127.0.0.1', port, method, path, headers: { origin: ORIGIN, 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), ...headers } }, response => {
      let text = ''; response.on('data', chunk => { text += chunk; }); response.on('end', () => { let json: any = null; try { json = JSON.parse(text); } catch {} resolve({ status: response.statusCode ?? 0, json }); });
    });
    request.on('error', reject); request.end(body);
  });
  const secret = randomBytes(32).toString('hex');
  return { call, secret, mintPairing, advance: (seconds: number) => { clock += seconds; }, pwa };
}

async function requestAndApprove(s: Awaited<ReturnType<typeof setup>>) {
  const created = await s.call('POST', '/_t3/pwa/create', { secret: s.secret });
  expect(created.status).toBe(201);
  const info = await s.call('GET', `/_t3/pwa/approval/${created.json.id}`, undefined, { cookie: COOKIE });
  expect(info.status).toBe(200);
  const decided = await s.call('POST', `/_t3/pwa/approval/${created.json.id}`, { decision: 'approve' }, { cookie: COOKIE, 'x-csrf-token': info.json.csrf });
  return { id: created.json.id as string, code: created.json.code as string, decided };
}

describe('PWAへの引き継ぎ: 申請・承認・受け取り(実際のHTTP)', () => {
  it('承認すると、承認したブラウザのセッションで、T3のペアリングの資格情報を発行する', async () => {
    const s = await setup();
    const { id, decided } = await requestAndApprove(s);
    expect(decided.status).toBe(200);
    expect(decided.json.state).toBe('approved');
    expect(s.mintPairing).toHaveBeenCalledTimes(1);
    expect(s.mintPairing.mock.calls[0][0]).toBe(COOKIE.split('=')[0] + '=' + COOKIE.split('=')[1]);
    expect(s.mintPairing.mock.calls[0][1]).toBe('tree-view-pwa:' + id);
  });
  it('PWAは受け取りで、ペアリングの資格情報を受け取る(Bearerのセッションは返さない)', async () => {
    const s = await setup();
    const { id } = await requestAndApprove(s);
    const status = await s.call('POST', '/_t3/pwa/status', { id, secret: s.secret });
    expect(status.json.state).toBe('approved');
    const claim = await s.call('POST', '/_t3/pwa/claim', { id, secret: s.secret });
    expect(claim.status).toBe(200);
    expect(claim.json).toEqual({ credential: 'ABCD2345EFGH' });
  });
  it('受け取りは1回だけ。2回目は拒否する', async () => {
    const s = await setup();
    const { id } = await requestAndApprove(s);
    expect((await s.call('POST', '/_t3/pwa/claim', { id, secret: s.secret })).status).toBe(200);
    expect((await s.call('POST', '/_t3/pwa/claim', { id, secret: s.secret })).status).toBe(409);
  });
  it('承認の前に受け取ろうとすると拒否する', async () => {
    const s = await setup();
    const created = await s.call('POST', '/_t3/pwa/create', { secret: s.secret });
    expect((await s.call('POST', '/_t3/pwa/claim', { id: created.json.id, secret: s.secret })).status).toBe(409);
  });
  it('申請した端末の秘密が違えば、状態も受け取りも見せない', async () => {
    const s = await setup();
    const { id } = await requestAndApprove(s);
    const other = randomBytes(32).toString('hex');
    expect((await s.call('POST', '/_t3/pwa/status', { id, secret: other })).status).toBe(404);
    expect((await s.call('POST', '/_t3/pwa/claim', { id, secret: other })).status).toBe(404);
  });
  it('ログインしていないブラウザは承認できず、資格情報も発行しない', async () => {
    const s = await setup();
    const created = await s.call('POST', '/_t3/pwa/create', { secret: s.secret });
    expect((await s.call('GET', `/_t3/pwa/approval/${created.json.id}`, undefined, { cookie: 'other=1' })).status).toBe(401);
    expect(s.mintPairing).not.toHaveBeenCalled();
  });
  it('資格情報を発行できなければ、承認を失敗として返し、受け取りもできない', async () => {
    const s = await setup({ mintPairing: vi.fn(async () => { throw new Error('t3 down'); }) });
    const { id, decided } = await requestAndApprove(s);
    expect(decided.status).toBe(503);
    expect((await s.call('POST', '/_t3/pwa/status', { id, secret: s.secret })).json.state).toBe('failed');
    expect((await s.call('POST', '/_t3/pwa/claim', { id, secret: s.secret })).status).toBe(409);
  });
  it('資格情報の期限(5分)を過ぎてから受け取ろうとすると拒否する', async () => {
    const s = await setup();
    const { id } = await requestAndApprove(s);
    s.advance(301);
    expect((await s.call('POST', '/_t3/pwa/claim', { id, secret: s.secret })).status).toBe(409);
  });
  it('資格情報は、データベースに保存しない(プロセスのメモリにだけ置く)', async () => {
    const s = await setup();
    await requestAndApprove(s);
    const dump = JSON.stringify(s.pwa.db.prepare('SELECT * FROM handoffs').all()) + JSON.stringify(s.pwa.db.prepare('SELECT * FROM events').all());
    expect(dump).not.toContain('ABCD2345EFGH');
  });
});

describe('引き継ぎを有効にする設定ファイル(コンテナを作り直しても、起動時に作る)', () => {
  // 2026-10-31、設定ファイル(/root/.t3/userdata/pwa-handoff/config.json)を作る処理がどこにも無く、
  // 本番では引き継ぎがずっと無効(申請・承認・受け取りが503)だった。プロキシの起動時に、無ければ作る。
  const { ensureHandoffConfig } = require('../containers/demo/t3-pwa-auth.cjs');
  const fs = require('node:fs') as typeof import('node:fs');
  const os = require('node:os') as typeof import('node:os');
  const path = require('node:path') as typeof import('node:path');
  const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 't3-handoff-')), 'pwa-handoff', 'config.json');
  it('無ければ、有効の設定を作る(世代はランダム、権限は0600)', () => {
    const file = tmp();
    expect(ensureHandoffConfig(file)).toBe('created');
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(value).toMatchObject({ enabled: true, developmentOnly: true });
    expect(value.generation).toMatch(/^[a-f0-9]{32}$/);
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });
  it('すでにあれば、書き換えない(利用者が無効にした設定を上書きしない)', () => {
    const file = tmp();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ enabled: false, developmentOnly: true, generation: 'keep' }));
    expect(ensureHandoffConfig(file)).toBe('kept');
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).enabled).toBe(false);
  });
  it('壊れたファイルも、書き換えずに残し、そのことを返す', () => {
    const file = tmp();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{broken');
    expect(ensureHandoffConfig(file)).toBe('invalid');
    expect(fs.readFileSync(file, 'utf8')).toBe('{broken');
  });
  it('プロキシの起動処理が、この関数を呼んでいる', () => {
    const proxy = fs.readFileSync('containers/demo/t3-embed-proxy.cjs', 'utf8');
    expect(proxy).toMatch(/ensureHandoffConfig\(\)/);
  });
});
