const http = require('node:http');
const net = require('node:net');
const { createPwaAuth, ensureHandoffConfig, injectBootstrap, nativeSession } = require('./t3-pwa-auth.cjs');
const { MAX_BODY, isUnauthenticatedSessionBody, rewriteSetCookies, staleSessionClears } = require('./t3-stale-session.cjs');
// Loopback-only HTTPS tunnel backend. Keep T3 authentication. Its HttpOnly session cookie is
// returned both partitioned and unpartitioned (t3-stale-session.cjs rewriteSetCookies).
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
  // T3はクッキーのセッションを、Originのホストが Host か X-Forwarded-Host と一致するときだけ受け付ける。
  // Hostを書き換えるので、元のホストを X-Forwarded-Host で渡す(渡さないと、発行直後のクッキーが拒否される)。
  const headers = { ...req.headers, host: '127.0.0.1:' + upstreamPort, 'x-forwarded-host': req.headers.host || '', 'accept-encoding': 'identity' };
  const upstream = http.request({ hostname: '127.0.0.1', port: upstreamPort, method: req.method, path: req.url, headers }, response => {
    const next = { ...response.headers };
    if (next['set-cookie']) next['set-cookie'] = rewriteSetCookies(next['set-cookie']);
    next['content-security-policy'] = "frame-ancestors https://dynamicneko.nekoflare.workers.dev http://127.0.0.1:4173";
    // T3が拒否した古いセッションのクッキーを削除して、ペアリング画面へ戻れるようにする(t3-stale-session.cjs)。
    // 401(通常のAPI)と、200の authenticated:false(/api/auth/session)の両方を対象にする。
    const isSessionCheck = req.method === 'GET' && req.url.split('?')[0] === '/api/auth/session' && response.statusCode === 200;
    if (req.headers.cookie && (response.statusCode === 401 || isSessionCheck)) {
      const chunks = []; let size = 0;
      response.on('data', chunk => { chunks.push(chunk); size += chunk.length; });
      response.on('error', () => res.destroy());
      response.on('end', () => {
        const body = Buffer.concat(chunks);
        const unauthenticated = isSessionCheck && size <= MAX_BODY && isUnauthenticatedSessionBody(body.toString('utf8'));
        // ログイン済みのブラウザを見たら記録する(同じ接続元のPWAの申請を自動で承認するため)。
        if (isSessionCheck && size <= MAX_BODY && !unauthenticated && pwa.noteOwner) { try { if (JSON.parse(body.toString('utf8')).authenticated === true) pwa.noteOwner(req); } catch {} }
        const send = clears => {
          if (clears.length) { next['set-cookie'] = [...(next['set-cookie'] || []), ...clears]; console.error('T3 stale session cleared: variants=' + clears.length); }
          res.writeHead(response.statusCode, next); res.end(body);
        };
        if (response.statusCode !== 401 && !unauthenticated) return send([]);
        resolveCookieName().then(cookieName => send(staleSessionClears({ status: response.statusCode, unauthenticated, cookieHeader: req.headers.cookie, cookieName }))).catch(() => send([]));
      });
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
  // PWAへの引き継ぎを有効にする設定。結果はログに残す(壊れていれば、引き継ぎは無効のまま)。
  try { console.error('T3 PWA handoff config: ' + ensureHandoffConfig()); } catch (error) { console.error('T3 PWA handoff config failed: ' + error.message); }
  const pwa = createPwaAuth(), server = createServer(pwa);
  void pwa.recover().then(() => {
    server.listen(3774, '127.0.0.1');
    setInterval(() => void pwa.recover().catch(() => console.error('T3 PWA recovery failed')), 60000).unref();
  }).catch(() => { console.error('T3 PWA startup recovery failed'); process.exit(1); });
}
if (require.main === module) start();
module.exports = { createServer, start };
