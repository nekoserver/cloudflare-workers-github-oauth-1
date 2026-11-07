import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import http from 'node:http';
import net, { type AddressInfo } from 'node:net';
import { Duplex, PassThrough } from 'node:stream';

const require = createRequire(import.meta.url);
const { forwardToMuse, checkMuseHealth, connectMuse, relayMuseNode, MUSE_NODE_ROUTE, MUSE_NC_ARGS, MUSE_MAX_BODY } = require('../containers/demo/server.js');

// 契約(Tailscale): userspace-networkingでは`tailscale nc <host> <port>`の標準入出力が
// tailnetへのTCP接続になる。lib/claude/ops/llm_worker_claude.pyのTailnetConnectionと同じ使い方。
describe('tailscale ncの契約', () => {
  it('接続先はmuse-vm:8080に固定する', () => {
    expect(MUSE_NC_ARGS).toEqual(['--socket=/var/run/tailscale/tailscaled.sock', 'nc', 'muse-vm', '8080']);
  });

  it('接続を閉じるとncを止める', async () => {
    const nc = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), killed: 0, kill() { this.killed += 1; } });
    const socket = connectMuse(() => nc);
    socket.destroy();
    await new Promise((resolve) => socket.once('close', resolve));
    expect(nc.killed).toBe(1);
  });

  it('tailscaleを起動できなければ接続のエラーになる', async () => {
    const nc = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), kill() {} });
    const socket = connectMuse(() => nc);
    const failed = new Promise<Error>((resolve) => socket.once('error', resolve));
    nc.emit('error', new Error('spawn tailscale ENOENT'));
    expect((await failed).message).toContain('ENOENT');
  });
});

describe('POST /muse/v1/chat/completions', () => {
  const servers: http.Server[] = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((s) => new Promise((resolve) => { s.closeAllConnections(); s.close(resolve); })));
  });

  async function listen(handler: http.RequestListener) {
    const server = http.createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    return (server.address() as AddressInfo).port;
  }

  async function proxy(connect: () => net.Socket) {
    return listen((req, res) => forwardToMuse(req, res, connect));
  }

  async function post(port: number, body: string, headers: Record<string, string> = { Authorization: 'Bearer k' }) {
    const response = await fetch(`http://127.0.0.1:${port}/muse/v1/chat/completions`, { method: 'POST', headers, body });
    return { status: response.status, text: await response.text(), headers: response.headers };
  }

  it('本文とAuthorizationだけを固定のパスへ渡し、応答をそのまま返す', async () => {
    let seen: { url?: string; method?: string; auth?: string; cookie?: string; body: string } = { body: '' };
    const muse = await listen((req, res) => {
      seen = { url: req.url, method: req.method, auth: req.headers.authorization, cookie: req.headers.cookie, body: '' };
      req.on('data', (chunk) => { seen.body += chunk; });
      req.on('end', () => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":1}'); });
    });
    const port = await proxy(() => net.connect(muse, '127.0.0.1'));
    const result = await post(port, '{"a":1}', { Authorization: 'Bearer k', Cookie: 'x=1' });
    expect(result).toMatchObject({ status: 200, text: '{"ok":1}' });
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(seen).toEqual({ url: '/v1/chat/completions', method: 'POST', auth: 'Bearer k', cookie: undefined, body: '{"a":1}' });
  });

  it('上流の失敗の状態コードを変えない', async () => {
    const muse = await listen((_req, res) => { res.writeHead(429); res.end('{}'); });
    const port = await proxy(() => net.connect(muse, '127.0.0.1'));
    expect((await post(port, '{}')).status).toBe(429);
  });

  // キーはコンテナに持たない。tailnetの端末は8080へ届くため、キー無しの要求を素通しさせない。
  it('Bearerキーが無ければ上流へつながない', async () => {
    let connected = 0;
    const port = await proxy(() => { connected += 1; return new net.Socket(); });
    expect((await post(port, '{}', {})).status).toBe(401);
    expect(connected).toBe(0);
  });

  it('GETは受け付けない', async () => {
    const port = await proxy(() => new net.Socket());
    expect((await fetch(`http://127.0.0.1:${port}/muse/v1/chat/completions`)).status).toBe(405);
  });

  it('大きすぎる本文は上流へつながず413を返す', async () => {
    let connected = 0;
    const port = await proxy(() => { connected += 1; return new net.Socket(); });
    expect((await post(port, 'x'.repeat(MUSE_MAX_BODY + 1))).status).toBe(413);
    expect(connected).toBe(0);
  });

  it('大きすぎる応答は途中で切らず502にする', async () => {
    const muse = await listen((_req, res) => { res.end('x'.repeat(MUSE_MAX_BODY + 1)); });
    const port = await proxy(() => net.connect(muse, '127.0.0.1'));
    const result = await post(port, '{}');
    expect(result.status).toBe(502);
    expect(JSON.parse(result.text).errorCode).toBe('muse_response_too_large');
  });

  it('つながらなければ502を返し、キーを応答に出さない', async () => {
    const closed = net.createServer();
    await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', () => resolve()));
    const unused = (closed.address() as AddressInfo).port;
    await new Promise((resolve) => closed.close(resolve));
    const port = await proxy(() => net.connect(unused, '127.0.0.1'));
    const result = await post(port, '{}', { Authorization: 'Bearer secret-key' });
    expect(result.status).toBe(502);
    expect(JSON.parse(result.text).errorCode).toBe('muse_connection_failed');
    expect(result.text).not.toContain('secret-key');
  });

  it('呼び出し側が切断したら上流の接続を閉じる', async () => {
    let closed: () => void;
    const upstreamClosed = new Promise<void>((resolve) => { closed = resolve; });
    const muse = await listen((req) => { req.resume(); req.socket.once('close', () => closed()); });
    const port = await proxy(() => net.connect(muse, '127.0.0.1'));
    const controller = new AbortController();
    const pending = fetch(`http://127.0.0.1:${port}/muse/v1/chat/completions`, { method: 'POST', headers: { Authorization: 'Bearer k' }, body: '{}', signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 100));
    controller.abort();
    await expect(pending).rejects.toThrow();
    await upstreamClosed;
  });
});

describe('GET /muse/health', () => {
  const servers: http.Server[] = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((s) => new Promise((resolve) => { s.closeAllConnections(); s.close(resolve); })));
  });

  async function listen(handler: http.RequestListener) {
    const server = http.createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    return (server.address() as AddressInfo).port;
  }

  const relay = (connect: () => net.Socket) => listen((req, res) => checkMuseHealth(req, res, connect));

  it('推論を走らせない固定のパスだけへ問い合わせ、応答をそのまま返す', async () => {
    let seen: { url?: string; method?: string; auth?: string } = {};
    const muse = await listen((req, res) => {
      seen = { url: req.url, method: req.method, auth: req.headers.authorization };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"status": "ok"}');
    });
    const port = await relay(() => net.connect(muse, '127.0.0.1'));
    const response = await fetch(`http://127.0.0.1:${port}/muse/health?x=1`, { headers: { Authorization: 'Bearer k' } });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"status": "ok"}');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(seen).toEqual({ url: '/health', method: 'GET', auth: undefined });
  });

  // 8080番はtailnetの端末からも届く。キーの無い要求は上流へつながない。
  it('Bearerキーが無ければ401で、上流へつながない', async () => {
    let connected = false;
    const port = await relay(() => { connected = true; return net.connect(1, '127.0.0.1'); });
    const response = await fetch(`http://127.0.0.1:${port}/muse/health`);
    expect(response.status).toBe(401);
    expect(connected).toBe(false);
  });

  it('GET以外は405で、上流へつながない', async () => {
    let connected = false;
    const port = await relay(() => { connected = true; return net.connect(1, '127.0.0.1'); });
    const response = await fetch(`http://127.0.0.1:${port}/muse/health`, { method: 'POST', headers: { Authorization: 'Bearer k' }, body: 'x' });
    expect(response.status).toBe(405);
    expect(connected).toBe(false);
  });

  // 故障想定: muse-vmがオフラインだと`tailscale nc`は応答しないまま待ち続ける(2026-11-06に実機で確認)。
  // connectMuseの返すDuplexにはsetTimeoutが無く、http.requestのtimeoutは発火しない。
  it('setTimeoutの無い接続で上流が応答しなくても、待ち時間で504を返す', async () => {
    const socket = new Duplex({ read() {}, write(_chunk, _encoding, callback) { callback(); } });
    const port = await listen((req, res) => checkMuseHealth(req, res, () => socket, 20));
    const response = await fetch(`http://127.0.0.1:${port}/muse/health`, { headers: { Authorization: 'Bearer k' }, signal: AbortSignal.timeout(2000) });
    expect(response.status).toBe(504);
    expect(socket.destroyed).toBe(true);
  });

  it('接続できなければ502を返す', async () => {
    const closed = await listen(() => {});
    await new Promise((resolve) => { const s = servers.pop()!; s.close(resolve); });
    const port = await relay(() => net.connect(closed, '127.0.0.1'));
    const response = await fetch(`http://127.0.0.1:${port}/muse/health`, { headers: { Authorization: 'Bearer k' } });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ errorCode: 'muse_connection_failed' });
  });
});

describe('/admin/muse/<ノード>/<health|nix>', () => {
  const servers: http.Server[] = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((s) => new Promise((resolve) => { s.closeAllConnections(); s.close(resolve); })));
  });

  async function listen(handler: http.RequestListener) {
    const server = http.createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    return (server.address() as AddressInfo).port;
  }

  it('ノードとパスは固定の組み合わせだけを受け付ける', () => {
    for (const url of ['/admin/muse/muse/health', '/admin/muse/muse-vm/health', '/admin/muse/muse/nix', '/admin/muse/muse-vm/nix']) {
      expect(MUSE_NODE_ROUTE.test(url)).toBe(true);
    }
    for (const url of ['/admin/muse/ipad/health', '/admin/muse/muse/v1/chat/completions', '/admin/muse/muse/nix?x=1', '/muse/muse/nix']) {
      expect(MUSE_NODE_ROUTE.test(url)).toBe(false);
    }
  });

  it('ncの接続先はノードごとに変わる', () => {
    let args: string[] = [];
    const nc = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), kill() {} });
    connectMuse((_: string, given: string[]) => { args = given; return nc; }, 'muse').destroy();
    expect(args).toEqual(['--socket=/var/run/tailscale/tailscaled.sock', 'nc', 'muse', '8080']);
  });

  it('nixは/nix/packagesへキーを付けて、healthはキーなしで問い合わせる', async () => {
    const seen: { url?: string; auth?: string }[] = [];
    const nodes: string[] = [];
    const upstream = await listen((req, res) => {
      seen.push({ url: req.url, auth: req.headers.authorization });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"packages": []}');
    });
    const port = await listen((req, res) => relayMuseNode(req, res, (node: string) => { nodes.push(node); return net.connect(upstream, '127.0.0.1'); }));
    const headers = { Authorization: 'Bearer k' };
    expect((await fetch(`http://127.0.0.1:${port}/admin/muse/muse/nix`, { headers })).status).toBe(200);
    expect((await fetch(`http://127.0.0.1:${port}/admin/muse/muse-vm/health`, { headers })).status).toBe(200);
    expect(seen).toEqual([{ url: '/nix/packages', auth: 'Bearer k' }, { url: '/health', auth: undefined }]);
    expect(nodes).toEqual(['muse', 'muse-vm']);
  });

  it('キーが無ければ上流へつながない', async () => {
    let connected = false;
    const port = await listen((req, res) => relayMuseNode(req, res, () => { connected = true; return new net.Socket(); }));
    expect((await fetch(`http://127.0.0.1:${port}/admin/muse/muse/nix`)).status).toBe(401);
    expect(connected).toBe(false);
  });

  it('接続できなければ502、応答が無ければ504を返す', async () => {
    const refused = await listen((req, res) => relayMuseNode(req, res, () => net.connect(1, '127.0.0.1')));
    expect((await fetch(`http://127.0.0.1:${refused}/admin/muse/muse/nix`, { headers: { Authorization: 'Bearer k' } })).status).toBe(502);
    const silent = await listen(() => {});
    const port = await listen((req, res) => relayMuseNode(req, res, () => net.connect(silent, '127.0.0.1'), 50));
    expect((await fetch(`http://127.0.0.1:${port}/admin/muse/muse-vm/nix`, { headers: { Authorization: 'Bearer k' } })).status).toBe(504);
  });
});

// 2026-11-06: オフラインのノードへの`tailscale nc`は何も返さずに終わる。httpは「socket hang up」の後に
// DuplexのABORT_ERRをもう一度errorとして出すので、onceのリスナーではプロセスごと落ちる。
describe('ノードが何も返さず接続を閉じたとき', () => {
  const servers: http.Server[] = [];
  const uncaught: unknown[] = [];
  const record = (error: unknown) => { uncaught.push(error); };
  beforeEach(() => { uncaught.length = 0; process.on('uncaughtException', record); });
  afterEach(async () => {
    process.off('uncaughtException', record);
    await Promise.all(servers.splice(0).map((s) => new Promise((resolve) => { s.closeAllConnections(); s.close(resolve); })));
  });

  async function listen(handler: http.RequestListener) {
    const server = http.createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    return (server.address() as AddressInfo).port;
  }

  // PassThroughでは再現しない。実際の子プロセスのstdioで、何も出さずに終わるncを作る。
  const connect = () => connectMuse((_: string, __: string[], options: object) => spawn('true', [], options));
  const headers = { Authorization: 'Bearer k' };

  it.each([
    ['/muse/health', 'GET', (req: http.IncomingMessage, res: http.ServerResponse) => checkMuseHealth(req, res, connect)],
    ['/muse/v1/chat/completions', 'POST', (req: http.IncomingMessage, res: http.ServerResponse) => forwardToMuse(req, res, connect)],
    ['/admin/muse/muse-vm/health', 'GET', (req: http.IncomingMessage, res: http.ServerResponse) => relayMuseNode(req, res, connect)],
    ['/admin/muse/muse-vm/nix', 'GET', (req: http.IncomingMessage, res: http.ServerResponse) => relayMuseNode(req, res, connect)],
  ])('%sは502を返し、プロセスは落ちない', async (path, method, handler) => {
    const port = await listen(handler);
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers, body: method === 'POST' ? '{}' : undefined });
    expect(response.status).toBe(502);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(uncaught).toEqual([]);
  });
});

// 2026-11-07: /muse-statusのシグナルが「接続できません」になっても、Tailscaleの到達不能・8080番の接続拒否・
// 途中切断の区別がつかなかった。ncのstderrは捨てていた。理由をそのまま返し、ページで見られるようにする。
// ncの文言は確かめていない(契約にしない)。stderrの内容を加工せず、長さだけ制限して返す。
describe('ノードへつながらないとき、ncのエラー出力を理由として返す', () => {
  const servers: http.Server[] = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((s) => new Promise((resolve) => { s.closeAllConnections(); s.close(resolve); })));
  });
  async function listen(handler: http.RequestListener) {
    const server = http.createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    return (server.address() as AddressInfo).port;
  }
  const failingNc = (stderr: string) => () => connectMuse((_: string, __: string[], options: object) => spawn('sh', ['-c', 'printf "%s" "$0" >&2; exit 1', stderr], options));
  const headers = { Authorization: 'Bearer k' };

  it('stderrの内容をdetailに入れて502を返す', async () => {
    const port = await listen((req, res) => relayMuseNode(req, res, failingNc('Dial("muse", 8080): connection refused\n')));
    const response = await fetch(`http://127.0.0.1:${port}/admin/muse/muse/health`, { headers });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ errorCode: 'muse_connection_failed', detail: 'Dial("muse", 8080): connection refused' });
  });

  it('長いstderrは末尾の300文字だけ返す', async () => {
    const long = 'x'.repeat(500) + 'END';
    const port = await listen((req, res) => relayMuseNode(req, res, failingNc(long)));
    const body = await (await fetch(`http://127.0.0.1:${port}/admin/muse/muse-vm/health`, { headers })).json();
    expect(body.detail).toHaveLength(300);
    expect(body.detail.endsWith('END')).toBe(true);
  });

  it('stderrが空ならdetailを付けない', async () => {
    const port = await listen((req, res) => relayMuseNode(req, res, failingNc('')));
    expect(await (await fetch(`http://127.0.0.1:${port}/admin/muse/muse-vm/health`, { headers })).json()).toEqual({ errorCode: 'muse_connection_failed' });
  });
});
