// /cf-containersページ(Cloudflare Containersのデモ用管理ページ)が起動・
// プロキシ対象にする、最小限のHTTPサーバー。外部依存を持たず、Node標準の
// http/netモジュールだけで動く(イメージサイズ・ビルド時間を抑えるため)。
//
// /healthは、entrypoint.shが起動するApache(8443)・sshd(2222)・
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

// tailscaledの状態(BackendState)がRunningかどうか。落ちている・未登録のときはfalse。
async function probeTailscaleRunning() {
  const out = await runCmd('tailscale', ['--socket=/var/run/tailscale/tailscaled.sock', 'status', '--json']);
  try {
    return JSON.parse(out).BackendState === 'Running';
  } catch {
    return false;
  }
}

// tailscale status --json から、相手ごとの接続経路(直接/DERP中継)をまとめる。
// CurAddrが空でなければP2Pの直接接続、空でRelayがあればDERP中継(Relayは中継先の地域)。
function summarizeTailscalePeers(status) {
  const self = status.Self || {};
  const peers = Object.values(status.Peer || {}).map((peer) => ({
    hostName: peer.HostName || '',
    dnsName: peer.DNSName || '',
    ip: (peer.TailscaleIPs || [])[0] || '',
    os: peer.OS || '',
    online: Boolean(peer.Online),
    active: Boolean(peer.Active),
    connection: peer.CurAddr ? 'direct' : peer.Relay ? 'relay' : 'none',
    curAddr: peer.CurAddr || '',
    relay: peer.Relay || '',
    lastHandshake: peer.LastHandshake || '',
  }));
  peers.sort((x, y) => Number(y.active) - Number(x.active) || Number(y.online) - Number(x.online) || x.hostName.localeCompare(y.hostName));
  return {
    backendState: status.BackendState || '',
    self: { hostName: self.HostName || '', dnsName: self.DNSName || '', ip: (self.TailscaleIPs || [])[0] || '' },
    peers,
  };
}

// dockerdに接続できるかどうか(docker infoが成功すればtrue)。
async function probeDockerRunning() {
  const out = await runCmd('docker', ['info', '--format', '{{.ServerVersion}}']);
  return /^[0-9]/.test(out.trim());
}

// 各コマンドの出力から版(例: 26.12.1、10.2p1)を取り出す。取れなければnull。
function extractVersion(text) {
  const m = String(text || '').match(/(\d+\.\d+(?:\.\d+)?(?:p\d+)?)/);
  return m ? m[1] : null;
}

// 版を数値の並びとして比べる(a>bなら正、a<bなら負、同じなら0)。
function compareVersions(a, b) {
  const pa = String(a).split(/\D+/).filter(Boolean).map(Number);
  const pb = String(b).split(/\D+/).filter(Boolean).map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

// 無い・最低版より古い→ng(赤)、想定の版と違う→warn(黄)、それ以外→ok(緑)。
function judgeVersion(actual, expected, minimum) {
  if (!actual) return 'ng';
  if (minimum && compareVersions(actual, minimum) < 0) return 'ng';
  if (expected && actual !== expected) return 'warn';
  return 'ok';
}

// key: /etc/image-versions.json(Dockerfileで固定した版)の項目名。minimum: 既知の脆弱性を避ける最低版
// (Node 26.12.1は2026-10-21のセキュリティリリース。CVE-2026-111497等)。
const VERSION_SOURCES = [
  { name: 'node', cmd: process.execPath, args: ['--version'], key: 'node', minimum: '26.12.1' },
  { name: 'apache', cmd: 'apache2ctl', args: ['-v'] },
  { name: 'openssh', cmd: 'ssh', args: ['-V'] },
  { name: 'openssl', cmd: 'openssl', args: ['version'] },
  { name: 'cloudflared', cmd: 'cloudflared', args: ['--version'], key: 'cloudflared' },
  { name: 'tailscale', cmd: 'tailscale', args: ['version'], key: 'tailscale' },
  { name: 'docker', cmd: 'docker', args: ['--version'] },
  { name: 'codex', cmd: 'codex', args: ['--version'], key: 'codex' },
  { name: 'claude', cmd: 'claude', args: ['--version'], key: 'claude' },
  { name: 'gh', cmd: 'gh', args: ['--version'], key: 'gh' },
  { name: 'git', cmd: 'git', args: ['--version'] },
  { name: 'jj', cmd: 'jj', args: ['--version'], key: 'jj' },
  { name: 'ruby', cmd: 'ruby', args: ['--version'], key: 'ruby' },
];

// aptで入れたネットワーク・CLIツール。実際の版(dpkg-query)と、Ubuntuアーカイブの最新(apt-cache policyのCandidate)を比べる。
const APT_TOOLS = [
  { name: 'rg', pkg: 'ripgrep' },
  { name: 'ag', pkg: 'silversearcher-ag' },
  { name: 'sshguard', pkg: 'sshguard' },
  { name: 'dig', pkg: 'bind9-dnsutils' },
  { name: 'ping', pkg: 'iputils-ping' },
  { name: 'ip', pkg: 'iproute2' },
  { name: 'netstat', pkg: 'net-tools' },
  { name: 'traceroute', pkg: 'traceroute' },
  { name: 'tcpdump', pkg: 'tcpdump' },
  { name: 'mtr', pkg: 'mtr-tiny' },
  { name: 'nft', pkg: 'nftables' },
  { name: 'nc', pkg: 'netcat-openbsd' },
  { name: 'whois', pkg: 'whois' },
  { name: 'top', pkg: 'procps' },
  { name: 'tmux', pkg: 'tmux' },
  { name: 'expect', pkg: 'expect' },
  { name: 'python3', pkg: 'python3' },
  { name: 'sudo', pkg: 'sudo' },
  { name: 'cron', pkg: 'cron' },
];

// apt-cache policyの出力から候補版(Candidate)を取り出す。候補が無いと(none)。
function parseAptCandidate(policyText) {
  const m = String(policyText || '').match(/^\s*Candidate:\s*(\S+)/m);
  return m && m[1] !== '(none)' ? m[1] : null;
}

// 入っていない=ng(赤)、最新が取れない=warn(黄)、最新より古い=warn(黄)、最新と同じか新しい=ok(緑)。
function judgeAptVersion(installed, latest) {
  if (!installed) return 'ng';
  if (!latest) return 'warn';
  return compareVersions(installed, latest) < 0 ? 'warn' : 'ok';
}

let aptToolsCache = null;

// apt-get updateは6時間に1回だけ。/healthの応答を遅くしないため、起動時と定期実行の中でだけ動かす。
async function refreshAptTools() {
  await new Promise((resolve) => {
    execFile('apt-get', ['update', '-qq'], { timeout: 300000, maxBuffer: 4 * 1024 * 1024 }, () => resolve());
  });
  const items = await Promise.all(
    APT_TOOLS.map(async (t) => {
      const installed = await new Promise((resolve) => {
        execFile('dpkg-query', ['-W', '-f=${Version}', t.pkg], { timeout: 8000 }, (err, out) => resolve(err ? null : out.trim() || null));
      });
      const latest = parseAptCandidate(await runVersionCmd('apt-cache', ['policy', t.pkg]));
      return { name: t.name, pkg: t.pkg, actual: installed, latest, level: judgeAptVersion(installed, latest) };
    })
  );
  // cfは自作(リポジトリ同梱)なので配布元の最新は無い。イメージのコミットで版の代わりにする。
  const build = readBuildInfo();
  const commit = build && build.commit && build.commit !== 'unknown' ? String(build.commit).slice(0, 7) : null;
  items.push({ name: 'cf', pkg: null, actual: commit, latest: null, level: commit ? 'ok' : 'warn', note: '自作(リポジトリ同梱・イメージのコミット)' });
  aptToolsCache = { items, checkedAt: new Date().toISOString() };
  return aptToolsCache;
}

// ssh -Vのように版を標準エラーに出すコマンドもあるため、両方をつなげて返す。
function runVersionCmd(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 8000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      resolve(`${stdout || ''}${stderr || ''}${err && !stdout && !stderr ? `[実行失敗: ${err.message}]` : ''}`.trim());
    });
  });
}

let versionsCache = null;

// どのコミット・ビルドから作ったイメージか(wrangler.tomlの[build]が書き出す)。無ければnull。
function readBuildInfo() {
  try {
    return JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname, 'build-info.json'), 'utf8'));
  } catch (err) {
    return { error: err.message };
  }
}

async function collectVersions() {
  let expected = {};
  let expectedError = null;
  try {
    expected = JSON.parse(require('node:fs').readFileSync('/etc/image-versions.json', 'utf8'));
  } catch (err) {
    expectedError = err.message;
  }
  const items = await Promise.all(
    VERSION_SOURCES.filter(s => !(s.name === 'docker' && readContainerFeatures()?.docker === false)).map(async (s) => {
      const raw = await runVersionCmd(s.cmd, s.args);
      const actual = extractVersion(raw.split('\n')[0]);
      const exp = s.key ? expected[s.key] || null : null;
      return { name: s.name, actual, expected: exp, minimum: s.minimum || null, level: judgeVersion(actual, exp, s.minimum), raw: raw.split('\n')[0].slice(0, 120) };
    })
  );
  versionsCache = { items, expectedError, checkedAt: new Date().toISOString() };
  return versionsCache;
}

function readContainerFeatures() {
  try { return JSON.parse(require('node:fs').readFileSync('/etc/container-features.json','utf8')); }
  catch { return null; } // Older images have no declared bundle choices.
}

async function buildHealth() {
  const [apache, sshd, cloudflared, tailscale, docker] = await Promise.allSettled([
    probeTcp(8443),
    probeTcp(2222),
    probeCloudflaredReady(),
    probeTailscaleRunning(),
    probeDockerRunning(),
  ]);
  const value = (settled) => (settled.status === 'fulfilled' ? settled.value : false);
  return {
    apache: value(apache),
    sshd: value(sshd),
    cloudflared: value(cloudflared),
    tailscale: value(tailscale),
    docker: value(docker),
    features: readContainerFeatures(),
    // 版の取得は時間がかかるため、起動時と10分ごとに取ったものを返す(初回は取得を待つ)
    versions: versionsCache || (await collectVersions()),
    build: readBuildInfo(),
    aptTools: aptToolsCache,
    checkedAt: new Date().toISOString(),
  };
}

// /debug/net: コンテナ自身のIPアドレス・ルーティング情報を返す。
// /cf-containers/proxy/* はauthMiddleware+cfDashboardAdminMiddleware経由
// (認証済み管理者のみ)でしかこのコンテナに到達できないため、ここでは
// 追加の認証は行わない(Worker側のアクセス制御に委ねる)。
function runCmd(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 8000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        resolve(`[実行失敗: ${err.message}] ${stderr || ''}`.trim());
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// The admin-only /cf-containers page can request this fixed, read-only CLI
// operation through the Worker proxy. Never accept a command or arguments from
// the request; pass the container-scoped token only through the child process
// environment and redact it from any captured output.
function runWranglerContainersList(res) {
  const token = process.env.CF_CONTAINER_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: 'CF_CONTAINER_API_TOKEN is not configured' }));
    return;
  }
  const childEnv = { ...process.env, CLOUDFLARE_API_TOKEN: token, NO_COLOR: '1' };
  execFile('wrangler', ['containers', 'list'], { env: childEnv, timeout: 30000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
    const redact = (value) => String(value || '').split(token).join('[REDACTED]').slice(0, 2 * 1024 * 1024);
    const result = {
      command: 'wrangler containers list',
      stdout: redact(stdout),
      stderr: redact(stderr),
      exitCode: err ? (typeof err.code === 'number' ? err.code : null) : 0,
      error: err ? redact(err.message) : null,
      checkedAt: new Date().toISOString(),
    };
    res.writeHead(err ? 502 : 200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(result));
  });
}

// cloudflaredの接続先(エッジ)の名前解決を、既定のDNS(IPv6のみの場合がある)と
// IPv4の1.1.1.1の両方で試し、名前解決で止まっているかを切り分ける。
const EDGE_HOST = 'region1.v2.argotunnel.com';
async function buildNetDebug() {
  const [addr, route, dns, netstat, netstatLegacy, top, digDefault, digV4, digTailscale, whois, ping, nftRuleset, dropLog, firewallStatsRaw] = await Promise.all([
    runCmd('ip', ['-o', 'addr', 'show']),
    runCmd('ip', ['-o', 'route', 'show']),
    runCmd('cat', ['/etc/resolv.conf']),
    runCmd('ss', ['-tulpn']),
    runCmd('netstat', ['-tunap']),
    runCmd('top', ['-b', '-n', '1']),
    runCmd('dig', ['+time=2', '+tries=1', EDGE_HOST]),
    runCmd('dig', ['+time=2', '+tries=1', '@1.1.1.1', EDGE_HOST]),
    runCmd('dig', ['+time=2', '+tries=1', '@1.1.1.1', 'controlplane.tailscale.com']),
    runCmd('whois', ['nekomaneki.work']),
    runCmd('ping', ['-c', '2', '-W', '2', '1.1.1.1']),
    // 破棄したパケットの件数と送信元(drop_src4/drop_src6)、カーネルログのnft-drop行
    runCmd('nft', ['list', 'ruleset']),
    runCmd('sh', ['-c', 'dmesg 2>/dev/null | grep nft-drop | tail -n 50']),
    runCmd('python3', [require('node:path').join(__dirname, 'firewall-stats.py')]),
  ]);
  return {
    addr, route, dns, netstat, netstatLegacy,
    top: top.split('\n').slice(0, 25).join('\n'),
    digDefault, digV4, digTailscale,
    whois: whois.split('\n').slice(0, 40).join('\n'),
    ping,
    nftRuleset,
    dropLog,
    firewallStats: (() => { try { return JSON.parse(firewallStatsRaw); } catch { return { available: false, error: firewallStatsRaw }; } })(),
    checkedAt: new Date().toISOString(),
  };
}

// /debug/logs: entrypoint.shが各デーモンの出力を書く/tmp/*.logの末尾を返す
// (cloudflaredがNGのときの原因調査用。/cf-containers/proxy/*は管理者のみ到達可能)。
const fs = require('node:fs');
const DEBUG_LOG_FILES = ['/tmp/dns.log', '/tmp/cloudflared.log', '/tmp/nftables.log', '/tmp/firewall.log', '/tmp/firewall-collector.log', '/tmp/apache.log', '/tmp/apache-configtest.log', '/tmp/sshd.log', '/tmp/tailscaled.log', '/tmp/tailscale-up.log', '/tmp/dockerd.log', '/tmp/sshguard.log', '/tmp/gh-setup-git.log'];
function tailFile(path, maxBytes) {
  try {
    const buf = fs.readFileSync(path);
    return buf.subarray(Math.max(0, buf.length - maxBytes)).toString('utf8');
  } catch (err) {
    return `[読めない: ${err.code || err.message}]`;
  }
}

// /admin/authorized-keys: Workerの /api/cf-containers/authorized-keys(管理者認証+HMAC照合済み)から
// 渡された公開鍵1行を/root/.ssh/authorized_keysへ追記する。Apache(トンネル側)は/adminを拒否し、
// Workerの汎用プロキシも/adminを転送しないため、ここへはそのAPI経由でしか届かない。
const AUTHORIZED_KEYS_PATH = '/root/.ssh/authorized_keys';
const PUBLIC_KEY_LINE = /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com) [A-Za-z0-9+\/]+={0,2}( [^\r\n]*)?$/;
function appendAuthorizedKey(req, res) {
  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 20000) req.destroy();
  });
  req.on('end', () => {
    const send = (status, payload) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(payload));
    };
    let key;
    try {
      key = String(JSON.parse(raw).publicKey || '').trim();
    } catch {
      return send(400, { error: 'JSONを読めません' });
    }
    if (!PUBLIC_KEY_LINE.test(key)) return send(400, { error: '公開鍵の形式が正しくありません' });
    try {
      fs.mkdirSync('/root/.ssh', { recursive: true, mode: 0o700 });
      let current = '';
      try { current = fs.readFileSync(AUTHORIZED_KEYS_PATH, 'utf8'); } catch (err) { if (err.code !== 'ENOENT') throw err; }
      const identity = key.split(' ').slice(0, 2).join(' ');
      if (current.split('\n').some((line) => line.trim().split(/\s+/).slice(0, 2).join(' ') === identity)) {
        return send(200, { ok: true, added: false, message: 'この公開鍵は既に登録されています' });
      }
      const prefix = current && !current.endsWith('\n') ? '\n' : '';
      fs.appendFileSync(AUTHORIZED_KEYS_PATH, prefix + key + '\n', { mode: 0o600 });
      fs.chmodSync(AUTHORIZED_KEYS_PATH, 0o600);
      return send(200, { ok: true, added: true });
    } catch (err) {
      return send(500, { error: 'authorized_keysへ書き込めません: ' + (err.code || err.message) });
    }
  });
}

// Redmine(Passenger配下、127.0.0.1:8444のみで待ち受け)への内部プロキシ。
// /redmine prefixを剥いで転送する(Apache側のVirtualHostはRedmineをルート直下に
// マウントしている)。外部からの到達は/cf-containers/proxy/*の認証経由のみ
// (ここに来る時点でWorker側のcfDashboardAdminMiddlewareを通過済み)。
const REDMINE_PREFIX = '/redmine';
function proxyToRedmine(req, res) {
  const forwardPath = req.url.slice(REDMINE_PREFIX.length) || '/';
  const upstream = http.request(
    { host: '127.0.0.1', port: 8444, method: req.method, path: forwardPath, headers: req.headers },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    }
  );
  upstream.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Redmineへのプロキシに失敗しました: ' + (err.code || err.message) }));
  });
  req.pipe(upstream);
}

const server = http
  .createServer((req, res) => {
    if (req.url === REDMINE_PREFIX || req.url.startsWith(REDMINE_PREFIX + '/') || req.url.startsWith(REDMINE_PREFIX + '?')) {
      proxyToRedmine(req, res);
      return;
    }
    if (req.method === 'POST' && req.url === '/admin/authorized-keys') {
      appendAuthorizedKey(req, res);
      return;
    }
    if (req.url === '/debug/tailscale-peers') {
      runCmd('tailscale', ['--socket=/var/run/tailscale/tailscaled.sock', 'status', '--json']).then((out) => {
        let body;
        try {
          body = { ...summarizeTailscalePeers(JSON.parse(out)), checkedAt: new Date().toISOString() };
        } catch {
          body = { error: 'tailscale status --json を読めません(tailscaledが起動していない可能性)', raw: out.slice(0, 2000) };
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(body));
      });
      return;
    }
    if (req.url === '/debug/logs') {
      const logs = {};
      for (const f of DEBUG_LOG_FILES) logs[f] = tailFile(f, 4000);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ logs, checkedAt: new Date().toISOString() }));
      return;
    }
    if (req.url === '/debug/redmine-dump') {
      // runCmdは失敗時も[実行失敗: ...]という文字列で解決する(例外にしない)ため、ここで判別する。
      runCmd('redmine-dump', []).then((sql) => {
        if (sql.startsWith('[実行失敗:')) {
          res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'redmine-dumpの実行に失敗しました: ' + sql }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/sql; charset=utf-8', 'Content-Disposition': 'attachment; filename="redmine-dump.sql"' });
        res.end(sql);
      });
      return;
    }
    if (req.url === '/debug/firewall') {
      runCmd('python3', [require('node:path').join(__dirname, 'firewall-stats.py')]).then((raw) => {
        try {
          const snapshot = JSON.parse(raw);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify(snapshot));
        } catch {
          res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ available: false, error: 'firewall_collection_failed' }));
        }
      });
      return;
    }
    if (req.url === '/debug/net') {
      buildNetDebug().then((net_) => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(net_));
      });
      return;
    }
    if (req.method === 'GET' && req.url === '/debug/wrangler/containers-list') {
      runWranglerContainersList(res);
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
  ;

module.exports = { summarizeTailscalePeers, extractVersion, compareVersions, judgeVersion, parseAptCandidate, judgeAptVersion, VERSION_SOURCES, APT_TOOLS };

// テストからrequireしたときは起動しない
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`demo container listening on port ${PORT}`);
  });
  collectVersions();
  refreshAptTools().catch((err) => console.error('[aptTools] refresh failed', err && err.message));
  setInterval(collectVersions, 10 * 60 * 1000).unref();
  setInterval(() => refreshAptTools().catch((err) => console.error('[aptTools] refresh failed', err && err.message)), 6 * 60 * 60 * 1000).unref();
}
