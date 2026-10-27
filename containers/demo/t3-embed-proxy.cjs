const http = require('node:http');
const net = require('node:net');
// Loopback-only HTTPS tunnel backend. Keep T3 authentication; partition its
// HttpOnly session cookie by the embedding site for third-party-cookie browsers.
const server = http.createServer((req, res) => {
  const headers = { ...req.headers, host: '127.0.0.1:3773' };
  const upstream = http.request({ hostname: '127.0.0.1', port: 3773, method: req.method, path: req.url, headers }, response => {
    const next = { ...response.headers };
    if (next['set-cookie']) next['set-cookie'] = next['set-cookie'].map(cookie => cookie.replace(/;\s*SameSite=[^;]+/ig, '').replace(/;\s*Secure\b/ig, '').replace(/;\s*Partitioned\b/ig, '') + '; SameSite=None; Secure; Partitioned');
    next['content-security-policy'] = "frame-ancestors https://dynamicneko.nekoflare.workers.dev http://127.0.0.1:4173";
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
server.listen(3774, '127.0.0.1');
