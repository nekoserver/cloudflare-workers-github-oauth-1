import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';

// 契約(T3 0.1.7 isBrowserOriginAllowed): クッキーのセッションは、Originのホストが Host か X-Forwarded-Host と
// 一致するときだけ受け付ける(Sec-Fetch-Site: same-origin のときは除く)。中継は Host を 127.0.0.1:<port> に
// 書き換えるので、元のホストを X-Forwarded-Host で渡さないと、発行直後のクッキーが拒否され、
// 「Timed out waiting for authenticated session after bootstrap.」になる。
const require = createRequire(import.meta.url);
const { createServer } = require('../containers/demo/t3-embed-proxy.cjs');
const servers: http.Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(s => new Promise(r => s.close(r)))); });
const listen = (s: http.Server) => new Promise<number>(r => { servers.push(s); s.listen(0, '127.0.0.1', () => r((s.address() as AddressInfo).port)); });

describe('中継は元のホストをT3に渡す', () => {
  it('X-Forwarded-Host に、ブラウザが要求したホストを入れる', async () => {
    let seen: http.IncomingHttpHeaders = {};
    const upstreamPort = await listen(http.createServer((req, res) => { seen = req.headers; res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); }));
    const pwa = { handle: async () => false };
    const port = await listen(createServer(pwa, { upstreamPort, resolveCookieName: async () => null }));
    await new Promise<void>((resolve, reject) => {
      http.get({ hostname: '127.0.0.1', port, path: '/api/x', headers: { host: 't3.nekomaneki.work', origin: 'https://t3.nekomaneki.work' } }, res => { res.resume(); res.on('end', () => resolve()); }).on('error', reject);
    });
    expect(seen.host).toBe('127.0.0.1:' + upstreamPort);
    expect(seen['x-forwarded-host']).toBe('t3.nekomaneki.work');
    // T3の判定と同じ計算で、受け付けられることを確かめる
    expect(new URL(String(seen.origin)).host).toBe(seen['x-forwarded-host']);
  });
});
