const http = require('node:http');
const net = require('node:net');
const { createPwaAuth, injectBootstrap, nativeSession } = require('./t3-pwa-auth.cjs');
const { staleSessionClears } = require('./t3-stale-session.cjs');
// Loopback-only HTTPS tunnel backend. Keep T3 authentication; partition its
// HttpOnly session cookie by the embedding site for third-party-cookie browsers.
// T3のセッション用クッキーの名前。認証していない状態でも /api/auth/session が返す。取得できなければnull(何も削除しない)。
async function defaultCookieName() {
  try {
    const name = (await nativeSession({}))?.auth?.sessionCookieName;
    return typeof name === 'string' && /^[A-Za-z0-9_.-]+$/.test(name) ? name : null;
  } catch { return null; }
}
function createServer(pwa, options = {}) {
const upstreamPort = options.upstreamPort || 3773;
const resolveCookieName = options.resolveCookieName || defaultCookieName;
const server = http.createServer(async (req, res) => {
  if (await pwa.handle(req, res)) return;
  const headers = { ...req.headers, host: '127.0.0.1:' + upstreamPort, 'accept-encoding': 'identity' };
  const upstream = http.request({ hostname: '127.0.0.1', port: upstreamPort, method: req.method, path: req.url, headers }, response => {
    const next = { ...response.headers };
    if (next['set-cookie']) next['set-cookie'] = next['set-cookie'].map(cookie => cookie.replace(/;\s*SameSite=[^;]+/ig, '').replace(/;\s*Secure\b/ig, '').replace(/;\s*Partitioned\b/ig, '') + '; SameSite=None; Secure; Partitioned');
    next['content-security-policy'] = "frame-ancestors https://dynamicneko.nekoflare.workers.dev http://127.0.0.1:4173";
    // T3が拒否した古いセッションのクッキーを削除して、ペアリング画面へ戻れるようにする(t3-stale-session.cjs)。
    if (response.statusCode === 401 && req.headers.cookie) {
      response.pause();
      resolveCookieName().then(cookieName => {
        const clears = staleSessionClears({ status: 401, cookieHeader: req.headers.cookie, cookieName });
        if (clears.length) {
          next['set-cookie'] = [...(next['set-cookie'] || []), ...clears];
          console.error('T3 stale session cleared: cookie=' + cookieName);
        }
      }).catch(() => {}).then(() => { res.writeHead(response.statusCode, next); response.pipe(res); response.resume(); });
      return;
    }
    if (req.method === 'GET' && response.headers['content-type']?.includes('text/html')) {
      delete next['content-length']; delete next.etag;
      next['cache-control'] = 'no-store';
      let html = '';
      response.on('data', chunk => { html += chunk; });
      response.on('error', () => res.destroy());
      response.on('end', () => { res.writeHead(response.statusCode, next); res.end(injectBootstrap(html)); });
      return;
    }
    res.writeHead(response.statusCode, next); response.pipe(res);
  });
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('T3 Code unavailable'); });
  req.pipe(upstream);
});
server.on('upgrade', (req, socket, head) => {
  const upstream = net.connect(3773, '127.0.0.1', () => {
    let headers = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) headers += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
    upstream.write(headers + '\r\n'); if (head.length) upstream.write(head);
    socket.pipe(upstream); upstream.pipe(socket);
  });
  upstream.on('error', () => socket.destroy()); socket.on('error', () => upstream.destroy());
  socket.on('close', () => upstream.destroy()); upstream.on('close', () => socket.destroy());
});
return server;
}
function start() {
  const pwa = createPwaAuth(), server = createServer(pwa);
  void pwa.recover().then(() => {
    server.listen(3774, '127.0.0.1');
    setInterval(() => void pwa.recover().catch(() => console.error('T3 PWA recovery failed')), 60000).unref();
  }).catch(() => { console.error('T3 PWA startup recovery failed'); process.exit(1); });
}
if (require.main === module) start();
module.exports = { createServer, start };
