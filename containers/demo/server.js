// /cf-containersページ(Cloudflare Containersのデモ用管理ページ)が起動・
// プロキシ対象にする、最小限のHTTPサーバー。外部依存を持たず、Node標準の
// http/netモジュールだけで動く(イメージサイズ・ビルド時間を抑えるため)。
//
// /healthは、entrypoint.shが起動するApache(8443)・sshd(22)・
// cloudflared(ローカルmetrics 20241)の疎通をそれぞれ独立に確認して返す。
// 1つの確認が失敗しても他の結果に影響しない(Promise.allSettled)。
const http = require('node:http');
const net = require('node:net');
const { execFile } = require('node:child_process');

const PORT = process.env.PORT || 8080;
const PROBE_TIMEOUT_MS = 1500;

function probeTcp(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port, timeout: PROBE_TIMEOUT_MS });
    const finish = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

function probeCloudflaredReady() {
  return new Promise((resolve) => {
    const req = http.get(
      { host: '127.0.0.1', port: 20241, path: '/ready', timeout: PROBE_TIMEOUT_MS },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.once('timeout', () => req.destroy());
    req.once('error', () => resolve(false));
  });
}

async function buildHealth() {
  const [apache, sshd, cloudflared] = await Promise.allSettled([
    probeTcp(8443),
    probeTcp(22),
    probeCloudflaredReady(),
  ]);
  const value = (settled) => (settled.status === 'fulfilled' ? settled.value : false);
  return {
    apache: value(apache),
    sshd: value(sshd),
    cloudflared: value(cloudflared),
    checkedAt: new Date().toISOString(),
  };
}

// /debug/net: コンテナ自身のIPアドレス・ルーティング情報を返す。
// /cf-containers/proxy/* はauthMiddleware+cfDashboardAdminMiddleware経由
// (認証済み管理者のみ)でしかこのコンテナに到達できないため、ここでは
// 追加の認証は行わない(Worker側のアクセス制御に委ねる)。
function runCmd(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: PROBE_TIMEOUT_MS * 2 }, (err, stdout, stderr) => {
      if (err) {
        resolve(`[実行失敗: ${err.message}] ${stderr || ''}`.trim());
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

async function buildNetDebug() {
  const [addr, route, dns, netstat] = await Promise.all([
    runCmd('ip', ['-o', 'addr', 'show']),
    runCmd('ip', ['-o', 'route', 'show']),
    runCmd('cat', ['/etc/resolv.conf']),
    runCmd('ss', ['-tulpn']),
  ]);
  return { addr, route, dns, netstat, checkedAt: new Date().toISOString() };
}

// /debug/logs: entrypoint.shが各デーモンの出力を書く/tmp/*.logの末尾を返す
// (cloudflaredがNGのときの原因調査用。/cf-containers/proxy/*は管理者のみ到達可能)。
const fs = require('node:fs');
const DEBUG_LOG_FILES = ['/tmp/cloudflared.log', '/tmp/nftables.log', '/tmp/apache.log', '/tmp/apache-configtest.log', '/tmp/sshd.log', '/tmp/tailscaled.log', '/tmp/tailscale-up.log'];
function tailFile(path, maxBytes) {
  try {
    const buf = fs.readFileSync(path);
    return buf.subarray(Math.max(0, buf.length - maxBytes)).toString('utf8');
  } catch (err) {
    return `[読めない: ${err.code || err.message}]`;
  }
}

http
  .createServer((req, res) => {
    if (req.url === '/debug/logs') {
      const logs = {};
      for (const f of DEBUG_LOG_FILES) logs[f] = tailFile(f, 4000);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ logs, checkedAt: new Date().toISOString() }));
      return;
    }
    if (req.url === '/debug/net') {
      buildNetDebug().then((net_) => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(net_));
      });
      return;
    }
    if (req.url === '/health') {
      buildHealth().then((health) => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(health));
      });
      return;
    }
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
