// /cf-containersページ(Cloudflare Containersのデモ用管理ページ)が起動・
// プロキシ対象にする、最小限のHTTPサーバー。外部依存を持たず、Node標準の
// httpモジュールだけで動く(イメージサイズ・ビルド時間を抑えるため)。
const http = require('node:http');

const PORT = process.env.PORT || 8080;

http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        message: 'cloudflare-workers-github-oauth-1 demo container',
        path: req.url,
        method: req.method,
        receivedAt: new Date().toISOString(),
      })
    );
  })
  .listen(PORT, () => {
    console.log(`demo container listening on port ${PORT}`);
  });
