import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomBytes } from 'node:crypto';

// 失敗したときに「何がどうなっていて、どうすれば直るか」が分かるようにする(2026-10-31、ユーザー指定)。
// 引き継ぎのサーバーは、失敗のたびに理由のコード(reason)と日本語の対処(remedy)を返す。
// 診断(GET /_t3/pwa/diagnose)は、項目ごとに ok と、だめなら理由と対処を返す。秘密(クッキー・資格情報)は返さない。
const require = createRequire(import.meta.url);
const { createPwaAuth, HANDOFF_REASONS } = require('../containers/demo/t3-pwa-auth.cjs');

const ORIGIN = 'https://t3.example.test';
const COOKIE = 't3_session_3773_abc=browser-session';
const OWNER = { authenticated: true, sessionMethod: 'browser-session-cookie', scopes: ['access:write', 'orchestration:read'], auth: { sessionCookieName: 't3_session_3773_abc' } };
const servers: http.Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve)))); });

async function setup(over: Record<string, unknown> = {}) {
  let clock = 1_800_000_000;
  const pwa = createPwaAuth({
    dbPath: ':memory:', origin: ORIGIN, key: randomBytes(32), now: () => clock,
    readConfig: () => ({ enabled: true, developmentOnly: true, generation: 'g1' }), generation: () => 'gen1',
    verifySession: async ({ cookie }: { cookie?: string }) => (cookie && cookie.includes(COOKIE) ? OWNER : { authenticated: false, auth: { sessionCookieName: 't3_session_3773_abc' } }),
    mintPairing: vi.fn(async () => ({ credential: 'ABCD2345EFGH', expiresAt: new Date((clock + 300) * 1000).toISOString() })),
    ...over,
  });
  const server = http.createServer(async (req, res) => { if (!(await pwa.handle(req, res))) { res.writeHead(404); res.end(); } });
  const port = await new Promise<number>(resolve => { servers.push(server); server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)); });
  const call = (method: string, path: string, data?: unknown, headers: Record<string, string> = {}) => new Promise<{ status: number; json: any; text: string }>((resolve, reject) => {
    const body = data === undefined ? '' : JSON.stringify(data);
    const request = http.request({ hostname: '127.0.0.1', port, method, path, headers: { origin: ORIGIN, 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), ...headers } }, response => {
      let text = ''; response.on('data', chunk => { text += chunk; }); response.on('end', () => { let json: any = null; try { json = JSON.parse(text); } catch {} resolve({ status: response.statusCode ?? 0, json, text }); });
    });
    request.on('error', reject); request.end(body);
  });
  return { call, advance: (s: number) => { clock += s; }, secret: randomBytes(32).toString('hex') };
}

describe('失敗の理由と対処(すべての理由に、具体的な対処がある)', () => {
  it('理由の一覧の、どれにも日本語の対処がある', () => {
    const entries = Object.entries(HANDOFF_REASONS as Record<string, string>);
    expect(entries.length).toBeGreaterThanOrEqual(7);
    for (const [reason, remedy] of entries) {
      expect(reason).toMatch(/^[a-z0-9_]+$/);
      expect(remedy.length, `${reason} に対処が無い`).toBeGreaterThan(10);
    }
  });
  it('引き継ぎが無効のとき: handoff_disabled と、設定ファイルの直し方を返す', async () => {
    const s = await setup({ readConfig: () => { throw new Error('ENOENT'); } });
    const response = await s.call('POST', '/_t3/pwa/create', { secret: s.secret });
    expect(response.status).toBe(503);
    expect(response.json.reason).toBe('handoff_disabled');
    expect(response.json.remedy).toBe(HANDOFF_REASONS.handoff_disabled);
  });
  it('ログインしていないブラウザで承認しようとしたとき: login_required と、ログインし直す対処を返す', async () => {
    const s = await setup();
    const created = await s.call('POST', '/_t3/pwa/create', { secret: s.secret });
    const response = await s.call('GET', `/_t3/pwa/approval/${created.json.id}`, undefined, { cookie: 'other=1' });
    expect(response.status).toBe(401);
    expect(response.json.reason).toBe('login_required');
    expect(response.json.remedy).toBe(HANDOFF_REASONS.login_required);
  });
  it('T3が資格情報を発行できなかったとき: pairing_mint_failed と、その対処を返す', async () => {
    const s = await setup({ mintPairing: vi.fn(async () => { throw new Error('HTTP 403'); }) });
    const created = await s.call('POST', '/_t3/pwa/create', { secret: s.secret });
    const info = await s.call('GET', `/_t3/pwa/approval/${created.json.id}`, undefined, { cookie: COOKIE });
    const decided = await s.call('POST', `/_t3/pwa/approval/${created.json.id}`, { decision: 'approve' }, { cookie: COOKIE, 'x-csrf-token': info.json.csrf });
    expect(decided.status).toBe(503);
    expect(decided.json.reason).toBe('pairing_mint_failed');
    expect(decided.json.detail).toContain('HTTP 403');
  });
  it('承認の前に受け取ろうとしたとき: not_approved_yet を返す', async () => {
    const s = await setup();
    const created = await s.call('POST', '/_t3/pwa/create', { secret: s.secret });
    const claim = await s.call('POST', '/_t3/pwa/claim', { id: created.json.id, secret: s.secret });
    expect(claim.status).toBe(409);
    expect(claim.json.reason).toBe('not_approved_yet');
  });
  it('期限(5分)を過ぎたとき: expired を返す', async () => {
    const s = await setup();
    const created = await s.call('POST', '/_t3/pwa/create', { secret: s.secret });
    s.advance(301);
    const claim = await s.call('POST', '/_t3/pwa/claim', { id: created.json.id, secret: s.secret });
    expect(claim.json.reason).toBe('expired');
  });
  it('申請が見つからない(別の端末・消えた)とき: request_not_found を返す', async () => {
    const s = await setup();
    const status = await s.call('POST', '/_t3/pwa/status', { id: 'b'.repeat(32), secret: s.secret });
    expect(status.status).toBe(404);
    expect(status.json.reason).toBe('request_not_found');
  });
});

describe('診断: GET /_t3/pwa/diagnose', () => {
  it('項目ごとに ok と、だめなら理由と対処を返し、秘密を含めない', async () => {
    const s = await setup();
    const response = await s.call('GET', '/_t3/pwa/diagnose', undefined, { cookie: COOKIE });
    expect(response.status).toBe(200);
    const names = response.json.checks.map((c: { name: string }) => c.name);
    expect(names).toEqual(expect.arrayContaining(['引き継ぎの設定', 'T3本体', 'このブラウザのT3のログイン', '最近の申請']));
    for (const check of response.json.checks) {
      expect(typeof check.ok).toBe('boolean');
      if (!check.ok) { expect(check.reason).toBeTruthy(); expect(check.remedy.length).toBeGreaterThan(10); }
    }
    expect(response.text).not.toContain('browser-session');
  });
  it('引き継ぎが無効なら、その項目がだめになり、設定の直し方が出る', async () => {
    const s = await setup({ readConfig: () => { throw new Error('ENOENT'); } });
    const response = await s.call('GET', '/_t3/pwa/diagnose');
    const config = response.json.checks.find((c: { name: string }) => c.name === '引き継ぎの設定');
    expect(config).toMatchObject({ ok: false, reason: 'handoff_disabled', remedy: HANDOFF_REASONS.handoff_disabled });
  });
  it('ログインしていないブラウザ(PWA)では、ログインの項目がだめになり、理由と対処が出る', async () => {
    const s = await setup();
    const response = await s.call('GET', '/_t3/pwa/diagnose');
    const login = response.json.checks.find((c: { name: string }) => c.name === 'このブラウザのT3のログイン');
    expect(login).toMatchObject({ ok: false, reason: 'login_required' });
  });
  it('T3本体に繋がらなければ、その項目がだめになる', async () => {
    const s = await setup({ verifySession: async () => { throw new Error('ECONNREFUSED'); } });
    const response = await s.call('GET', '/_t3/pwa/diagnose');
    const t3 = response.json.checks.find((c: { name: string }) => c.name === 'T3本体');
    expect(t3).toMatchObject({ ok: false, reason: 't3_unreachable' });
    expect(t3.detail).toContain('ECONNREFUSED');
  });
});
