// /cf-containersページ(Cloudflare Containersのデモ用管理ページ)が起動・
// プロキシ対象にする、最小限のHTTPサーバー。外部依存を持たず、Node標準の
// http/netモジュールだけで動く(イメージサイズ・ビルド時間を抑えるため)。
//
// /healthは、entrypoint.shが起動するApache(8443)・sshd(2222)・
// cloudflared(ローカルmetrics 20241)の疎通をそれぞれ独立に確認して返す。
// 1つの確認が失敗しても他の結果に影響しない(Promise.allSettled)。
const http = require('node:http');
const net = require('node:net');
const { execFile, spawn } = require('node:child_process');
const { Duplex } = require('node:stream');

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
    lastSeen: peer.LastSeen || '',
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
// optional: 入っていなくても異常ではないもの。無ければNGではなく「未導入」と出す。
const VERSION_SOURCES = [
  { name: 'node', cmd: process.execPath, args: ['--version'], key: 'node', minimum: '26.12.1' },
  { name: 'apache', cmd: 'apache2ctl', args: ['-v'], key: 'apache' },
  { name: 'openssh', cmd: 'ssh', args: ['-V'], key: 'openssh' },
  { name: 'openssl', cmd: 'openssl', args: ['version'] },
  { name: 'cloudflared', cmd: 'cloudflared', args: ['--version'], key: 'cloudflared' },
  { name: 'tailscale', cmd: 'tailscale', args: ['version'], key: 'tailscale' },
  { name: 'docker', cmd: 'docker', args: ['--version'] },
  { name: 'codex', cmd: 'codex', args: ['--version'], key: 'codex' },
  { name: 'claude', cmd: 'claude', args: ['--version'], key: 'claude' },
  { name: 'gh', cmd: 'gh', args: ['--version'], key: 'gh' },
  { name: 'git', cmd: 'git', args: ['--version'], key: 'git' },
  { name: 'jj', cmd: 'jj', args: ['--version'], key: 'jj' },
  { name: 't3', cmd: 't3', args: ['--version'], key: 't3' },
  { name: 'preprint', cmd: 'preprint', args: ['--version'], key: 'preprint' },
  { name: 'ruby', cmd: 'ruby', args: ['--version'], key: 'ruby' },
  { name: 'kernel', cmd: 'uname', args: ['-r'] },
  { name: 'glibc', cmd: 'getconf', args: ['GNU_LIBC_VERSION'] },
  { name: 'go', cmd: 'go', args: ['version'], optional: true },
];

// aptで入れたネットワーク・CLIツール。実際の版(dpkg-query)と、Ubuntuアーカイブの最新(apt-cache policyのCandidate)を比べる。
const APT_TOOLS = [
  { name: 'apt', pkg: 'apt' },
  { name: 'rg', pkg: 'ripgrep' },
  { name: 'ag', pkg: 'silversearcher-ag' },
  { name: 'sshguard', pkg: 'sshguard' },
  { name: 'curl', pkg: 'curl' },
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
      return { name: s.name, actual, expected: exp, minimum: s.minimum || null, level: s.optional && !actual ? 'none' : judgeVersion(actual, exp, s.minimum), raw: raw.split('\n')[0].slice(0, 120) };
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

// --- T3 Code ---
// 本体(3773)と埋め込み用の中継(3774)の待ち受け・応答、Codexの版とサインイン状態を調べる。
// /healthとは別に /health/t3 で返す(codexコマンドの待ち時間で、起動確認に使う/healthを遅くしないため)。
// サインイン情報(auth.json)の中身は読まない。有無と権限だけを返す。
const T3_SERVER_PORT = 3773;
const T3_PROXY_PORT = 3774;
const T3_LOOPBACK = ['127.0.0.1', '[::1]'];
const CODEX_AUTH_FILE = () => `${process.env.CODEX_HOME || `${process.env.HOME || '/root'}/.codex`}/auth.json`;

// codex login status の結果。終了コード0=サインイン済み、1=未サインイン、それ以外・実行不可は決めない(null)。
function parseCodexLoginStatus(code, output) {
  const summary = String(output || '').split('\n')[0].trim().slice(0, 120);
  if (code === 0) return { loggedIn: true, summary };
  if (code === 1) return { loggedIn: false, summary };
  return { loggedIn: null, summary };
}

// ss -ltn の出力から、ポートごとの待ち受けアドレスを取り出す。
function parseListenAddresses(text) {
  const result = {};
  for (const line of String(text || '').split('\n')) {
    const cols = line.trim().split(/\s+/);
    if (cols[0] !== 'LISTEN' || !cols[3]) continue;
    const i = cols[3].lastIndexOf(':');
    if (i < 0) continue;
    result[cols[3].slice(i + 1)] = cols[3].slice(0, i);
  }
  return result;
}

// 集めた結果から総合の状態を決める。足りない項目があるときは ready にしない。
function judgeT3Health(h) {
  const server = (h && h.server) || {};
  const proxy = (h && h.proxy) || {};
  const codex = (h && h.codex) || {};
  const reasons = [];
  const ok2xx = (n) => typeof n === 'number' && n >= 200 && n < 300;
  const exposed = [server, proxy].filter((x) => x.listenAddress && !T3_LOOPBACK.includes(x.listenAddress));
  const authFile = codex.authFile || {};
  if (authFile.exists && authFile.mode && authFile.mode !== '600') reasons.push(`auth.json の権限が ${authFile.mode} です(600 が望ましい)`);
  if (proxy.listening && !proxy.frameAncestors) reasons.push('中継の応答に frame-ancestors が付いていません');
  const unknownAddress = [server, proxy].filter((x) => x.listening && !x.listenAddress);
  if (unknownAddress.length > 0) reasons.push(`${unknownAddress.map((x) => x.port).join('・')} の待ち受けアドレスを確認できませんでした(外に公開されていないか未確認)`);
  const done = (state, why) => ({ state, reasons: why ? [why, ...reasons] : reasons });
  if (exposed.length > 0) return done('exposed', `${exposed.map((x) => x.port).join('・')} が ${exposed.map((x) => x.listenAddress).join('・')} で待ち受けています(127.0.0.1 だけにしてください)`);
  if (!server.listening) return done('server-down', `T3本体(${T3_SERVER_PORT})が待ち受けていません`);
  if (!ok2xx(server.httpStatus)) return done('server-error', `T3本体(${T3_SERVER_PORT})のHTTP応答が正常ではありません(${server.httpStatus ?? '応答なし'})`);
  if (!proxy.listening) return done('proxy-down', `埋め込み用の中継(${T3_PROXY_PORT})が待ち受けていません`);
  if (!ok2xx(proxy.httpStatus)) return done('proxy-error', `埋め込み用の中継(${T3_PROXY_PORT})のHTTP応答が正常ではありません(${proxy.httpStatus ?? '応答なし'})`);
  if (!codex.installed) return done('codex-missing', 'codex コマンドが見つかりません');
  if (codex.loggedIn === false) return done('login-required', 'Codex が未サインインです(codex login を実行してください)');
  if (codex.loggedIn !== true) return done('login-unknown', 'Codex のサインイン状態を確認できませんでした');
  return done('ready', null);
}

function httpGetProbe(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path, timeout: PROBE_TIMEOUT_MS }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (c) => { if (size < 4096) { chunks.push(c); size += c.length; } });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8').slice(0, 4096) }));
    });
    req.once('timeout', () => req.destroy(new Error('timeout')));
    req.once('error', reject);
  });
}

function runCmdWithCode(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 5000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      const out = `${stdout || ''}${stderr || ''}`.trim();
      if (!err) return resolve({ code: 0, out });
      resolve({ code: typeof err.code === 'number' ? err.code : null, out: out || String(err.message || err) });
    });
  });
}

async function statAuthFile() {
  try {
    const st = await require('node:fs/promises').stat(CODEX_AUTH_FILE());
    return { exists: true, mode: (st.mode & 0o777).toString(8) };
  } catch {
    return { exists: false, mode: null };
  }
}

// tree-view・PWAで、トークンを手で入れずにT3へ入るためのペアリングを作る。
// /cf-containers/proxy/* (GitHubログイン済みの管理者だけ)からしか届かない。
// 契約(T3 0.1.8): `t3 auth pairing create --json --base-url` は {credential, expiresAt, pairUrl} を出す。
const T3_ORIGIN = 'https://t3.nekomaneki.work';
const T3_BINARY = '/root/.t3/runtime/versions/0.1.8/t3';
const T3_PAIRING_ARGS = ['auth', 'pairing', 'create', '--json', '--label', 'one-click', '--base-url', T3_ORIGIN];
function runT3(args) {
  return new Promise((resolve, reject) => {
    execFile(T3_BINARY, args, { timeout: 20000, maxBuffer: 1024 * 1024, env: { ...process.env, HOME: '/root' } }, (error, stdout, stderr) => {
      if (error) reject(new Error((String(stderr || '').trim().split('\n')[0] || error.message).slice(0, 300)));
      else resolve(String(stdout));
    });
  });
}
async function issueT3Pairing(run = runT3) {
  let out;
  try { out = await run(T3_PAIRING_ARGS); } catch (error) {
    return { ok: false, errorCode: 'cli_failed', detail: String(error && error.message || error), remedy: 'T3が起動していないか、T3のデータ(/root/.t3)がありません。コンテナのターミナルで tail -30 /tmp/t3.log を確認してください。' };
  }
  try {
    const data = JSON.parse(out);
    if (typeof data.pairUrl === 'string' && data.pairUrl.startsWith(T3_ORIGIN + '/pair#token=') && typeof data.expiresAt === 'string') return { ok: true, pairUrl: data.pairUrl, expiresAt: data.expiresAt };
  } catch {}
  return { ok: false, errorCode: 'unexpected_output', detail: 'T3の出力が想定と違います', remedy: 'T3の版が0.1.8と違う可能性があります。契約テスト(src/cf-containers-t3-one-click-pairing.test.ts)をその版で確かめ直してください。' };
}

// tree-viewのiframe用。iOSのSafariはiframeの中でクッキーを保存・送信しないため、Bearerトークンを発行する。
// 契約(T3 0.1.7): `t3 auth session issue --json` は {sessionId, token, expiresAt, ...} を出す。
const T3_SESSION_ARGS = ['auth', 'session', 'issue', '--json', '--ttl', '24h', '--label', 'tree-view', '--subject', 'tree-view'];
async function issueT3Session(run = runT3) {
  let out;
  try { out = await run(T3_SESSION_ARGS); } catch (error) {
    return { ok: false, errorCode: 'cli_failed', detail: String(error && error.message || error), remedy: 'T3が起動していないか、T3のデータ(/root/.t3)がありません(詳細は /tmp/t3.log)。' };
  }
  try {
    const data = JSON.parse(out);
    const expires = Date.parse(data.expiresAt) / 1000;
    if (typeof data.token === 'string' && data.token.length >= 8 && Number.isFinite(expires)) return { ok: true, token: data.token, expires };
  } catch {}
  return { ok: false, errorCode: 'unexpected_output', detail: 'T3の出力が想定と違います', remedy: 'T3の版が0.1.7と違う可能性があります(契約テスト: src/cf-containers-t3-one-click-pairing.test.ts)。' };
}
const REAL_T3_DEPS = { probeTcp, httpGet: httpGetProbe, runCmd: runCmdWithCode, statFile: statAuthFile };

async function collectT3Health(deps = REAL_T3_DEPS) {
  const errors = [];
  const attempt = async (label, fn, fallback) => {
    try { return await fn(); } catch (err) { errors.push(`${label}: ${err && err.message ? err.message : err}`); return fallback; }
  };
  const [serverTcp, proxyTcp, serverHttp, proxyHttp, ss, codexVersion, codexLogin, authFile] = await Promise.all([
    attempt('probeTcp(3773)', () => deps.probeTcp(T3_SERVER_PORT), false),
    attempt('probeTcp(3774)', () => deps.probeTcp(T3_PROXY_PORT), false),
    attempt('GET 3773', () => deps.httpGet(T3_SERVER_PORT, '/.well-known/t3/environment'), null),
    attempt('GET 3774', () => deps.httpGet(T3_PROXY_PORT, '/'), null),
    attempt('ss', () => deps.runCmd('ss', ['-ltn']), { code: null, out: '' }),
    attempt('codex --version', () => deps.runCmd('codex', ['--version']), { code: null, out: '' }),
    attempt('codex login status', () => deps.runCmd('codex', ['login', 'status']), { code: null, out: '' }),
    attempt('stat auth.json', () => deps.statFile(), { exists: false, mode: null }),
  ]);
  const listen = parseListenAddresses(ss.out);
  let environmentKeys = [];
  if (serverHttp && serverHttp.body) {
    try {
      const parsed = JSON.parse(serverHttp.body);
      if (parsed && typeof parsed === 'object') environmentKeys = Object.keys(parsed).slice(0, 20);
    } catch { /* JSONでない応答は、キーを出さないだけ */ }
  }
  const installed = codexVersion.code === 0;
  const login = installed ? parseCodexLoginStatus(codexLogin.code, codexLogin.out) : { loggedIn: null, summary: '' };
  const csp = proxyHttp && proxyHttp.headers ? proxyHttp.headers['content-security-policy'] : '';
  const result = {
    server: { port: T3_SERVER_PORT, listening: Boolean(serverTcp), listenAddress: listen[String(T3_SERVER_PORT)] || null, httpStatus: serverHttp ? serverHttp.status : null, environmentKeys },
    proxy: { port: T3_PROXY_PORT, listening: Boolean(proxyTcp), listenAddress: listen[String(T3_PROXY_PORT)] || null, httpStatus: proxyHttp ? proxyHttp.status : null, frameAncestors: typeof csp === 'string' ? csp : '' },
    codex: {
      installed,
      version: installed ? extractVersion(codexVersion.out) : null,
      loggedIn: login.loggedIn,
      loginSummary: login.summary,
      authFile: { exists: Boolean(authFile && authFile.exists), mode: authFile && authFile.mode ? authFile.mode : null },
      home: process.env.HOME || null,
      codexHome: process.env.CODEX_HOME || null,
    },
    errors,
    checkedAt: new Date().toISOString(),
  };
  const verdict = judgeT3Health(result);
  return { ...result, state: verdict.state, reasons: verdict.reasons };
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
  execFile('wrangler', ['containers', 'list', '--json'], { env: childEnv, timeout: 30000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
    const redact = (value) => String(value || '').split(token).join('[REDACTED]').slice(0, 2 * 1024 * 1024);
    const result = {
      command: 'wrangler containers list --json',
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
// SSHのホスト鍵(公開鍵)。起動のたびに ssh-keygen -A で作られ、作り直すと変わるため、登録の応答で返す。
// tree-viewのターミナルは、受け取った鍵で known_hosts を書き直して厳密に照合する。返すのは種類とbase64だけ。
function readHostKeys(dir = '/etc/ssh') {
  let names = [];
  try { names = fs.readdirSync(dir).filter((name) => /^ssh_host_[a-z0-9]+_key\.pub$/.test(name)); } catch { return []; }
  const keys = [];
  for (const name of names) {
    try {
      const line = fs.readFileSync(dir + '/' + name, 'utf8').trim();
      if (PUBLIC_KEY_LINE.test(line)) keys.push(line.split(' ').slice(0, 2).join(' '));
    } catch {}
  }
  return keys;
}
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
        return send(200, { ok: true, added: false, message: 'この公開鍵は既に登録されています', hostKeys: readHostKeys() });
      }
      const prefix = current && !current.endsWith('\n') ? '\n' : '';
      fs.appendFileSync(AUTHORIZED_KEYS_PATH, prefix + key + '\n', { mode: 0o600 });
      fs.chmodSync(AUTHORIZED_KEYS_PATH, 0o600);
      return send(200, { ok: true, added: true, hostKeys: readHostKeys() });
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

// /askmuse用の中継。Workerはtailnetに参加できないので、ここからmuse-vmへ1本だけ通す。
// 送り先は固定し、キーは持たず呼び出し側のAuthorizationを渡すだけにする(環境変数に
// 置くとT3やエージェントの子プロセスから読める)。8080はtailnetの端末からも届くが、
// キーが無ければ上流へつながない。解釈と制限はWorker側(src/utils/museDirectAsk.ts)で行う。
const MUSE_PROXY_PATH = '/muse/v1/chat/completions';
const MUSE_NC_ARGS = ['--socket=/var/run/tailscale/tailscaled.sock', 'nc', 'muse-vm', '8080'];
const MUSE_MAX_BODY = 1024 * 1024;
const MUSE_TIMEOUT_MS = 300 * 1000;
// 死活確認の入口。muse-vmの/healthは推論を走らせない。
const MUSE_HEALTH_PATH = '/muse/health';
const MUSE_HEALTH_TIMEOUT_MS = 5 * 1000;
// /muse-status用。着信可能なmuse-vmのシグナルとNixの一覧だけを扱う。送り先とパスは
// ここに固定し、呼び出し側からは選ばせない。/adminはApache(トンネル側)が拒否し、Workerの
// 汎用プロキシも転送しないので、ここへはWorkerのDurable Object経由でしか届かない。
const MUSE_NODE_ROUTE = /^\/admin\/muse\/(muse-vm)\/(health|nix)$/;
const MUSE_NIX_PATH = '/nix/packages';
const MUSE_NIX_TIMEOUT_MS = 15 * 1000;

// tailscaledはuserspace-networkingなので、`tailscale nc`の標準入出力をソケットとして使う。
// ncのエラー出力は、つながらなかった理由として末尾だけ返す(文言は加工しない。tailscale ncの文言は契約にしない)。
const MUSE_NC_STDERR_MAX = 300;
// つながらなかったとき、ncの終了(=エラー出力の書き終わり)をこれだけ待ってから応答する。
const MUSE_NC_EXIT_WAIT_MS = 500;

function connectMuse(spawnNc = spawn) {
  // museは外向き専用。旧呼び出しが第2引数を渡しても接続先は変えない。
  const nc = spawnNc('tailscale', MUSE_NC_ARGS, { stdio: ['pipe', 'pipe', 'pipe'] });
  const socket = Duplex.from({ readable: nc.stdout, writable: nc.stdin });
  let stderr = '';
  if (nc.stderr) {
    nc.stderr.setEncoding('utf8');
    nc.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-4 * MUSE_NC_STDERR_MAX); });
  }
  const exited = new Promise((resolve) => { nc.once('close', resolve); nc.once('error', resolve); });
  // つながらなかった理由。ncの終了を待ってから(最大MUSE_NC_EXIT_WAIT_MS)、空白を除いた末尾を返す。空ならnull。
  socket.ncFailureDetail = async () => {
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, MUSE_NC_EXIT_WAIT_MS))]);
    const text = stderr.trim();
    return text ? text.slice(-MUSE_NC_STDERR_MAX) : null;
  };
  nc.once('error', (err) => socket.destroy(err));
  // 接続の失敗はhttp.requestのerrorで返す。応答後にdestroyするとDuplex.fromはABORT_ERRを
  // 出し、httpのリスナーは外れているので、ここで受けないとプロセスごと落ちる。
  socket.on('error', () => {});
  socket.once('close', () => nc.kill());
  return socket;
}

function sendMuseProxyError(res, status, errorCode, detail = null) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(detail ? { errorCode, detail } : { errorCode }));
}

function readLimited(stream, onDone, onTooLarge) {
  const chunks = [];
  let size = 0;
  let tooLarge = false;
  stream.on('data', (chunk) => {
    size += chunk.length;
    if (size > MUSE_MAX_BODY) {
      if (!tooLarge) onTooLarge();
      tooLarge = true;
      return;
    }
    chunks.push(chunk);
  });
  stream.on('end', () => {
    if (!tooLarge) onDone(Buffer.concat(chunks));
  });
}

function forwardToMuse(req, res, connect = connectMuse) {
  if (req.method !== 'POST') {
    req.resume();
    sendMuseProxyError(res, 405, 'method_not_allowed');
    return;
  }
  const authorization = req.headers.authorization;
  if (!/^Bearer \S+$/.test(authorization || '')) {
    req.resume();
    sendMuseProxyError(res, 401, 'muse_not_authenticated');
    return;
  }
  readLimited(req, (body) => {
    const upstream = http.request(
      {
        host: 'muse-vm',
        port: 8080,
        method: 'POST',
        path: '/v1/chat/completions',
        headers: { Authorization: authorization, 'Content-Type': 'application/json', 'Content-Length': body.length },
        // agentは指定しない。指定するとcreateConnectionが無視され、muse-vmをDNSで引いて失敗する(Node 26で確認)。
        // 省略時はagentなしのConnection: closeになり、応答ごとにncが終わる。
        createConnection: () => connect(),
        timeout: MUSE_TIMEOUT_MS,
      },
      (response) => {
        readLimited(
          response,
          (payload) => {
            res.writeHead(response.statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(payload);
          },
          () => {
            sendMuseProxyError(res, 502, 'muse_response_too_large');
            upstream.destroy();
          }
        );
      }
    );
    upstream.once('timeout', () => {
      sendMuseProxyError(res, 504, 'llm_timeout');
      upstream.destroy();
    });
    upstream.on('error', () => {
      if (!res.headersSent) sendMuseProxyError(res, 502, 'muse_connection_failed');
    });
    res.once('close', () => upstream.destroy());
    upstream.end(body);
  }, () => sendMuseProxyError(res, 413, 'prompt_too_large'));
}

// 上流へのGETを1回だけ中継する。キーを渡すのは本文にキーが要るパスだけ(/healthには渡さない)。
function relayMuseGet(req, res, { node, path, connect, timeoutMs, passAuthorization }) {
  if (req.method !== 'GET') {
    req.resume();
    sendMuseProxyError(res, 405, 'method_not_allowed');
    return;
  }
  const authorization = req.headers.authorization;
  if (!/^Bearer \S+$/.test(authorization || '')) {
    sendMuseProxyError(res, 401, 'muse_not_authenticated');
    return;
  }
  let socket = null;
  const upstream = http.request(
    {
      host: node,
      port: 8080,
      method: 'GET',
      path,
      headers: passAuthorization ? { Authorization: authorization } : {},
      // forwardToMuseと同じく、agentは指定しない。
      createConnection: () => (socket = connect()),
    },
    (response) => {
      readLimited(
        response,
        (payload) => {
          res.writeHead(response.statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(payload);
        },
        () => {
          sendMuseProxyError(res, 502, 'muse_response_too_large');
          upstream.destroy();
        }
      );
    }
  );
  // http.requestのtimeoutは使えない。connectMuseのDuplexにはsetTimeoutが無く発火しない。
  // ノードがオフラインだと`tailscale nc`は応答しないまま待ち続けることがあるので、ここで打ち切る。
  const timer = setTimeout(() => {
    sendMuseProxyError(res, 504, 'llm_timeout');
    upstream.destroy();
  }, timeoutMs);
  // errorは2回出ることがある(socket hang upの後にABORT_ERR)。onで受け、応答は1回だけにする。
  let failed = false;
  upstream.on('error', () => {
    if (failed || res.headersSent) return;
    failed = true;
    const detail = socket && typeof socket.ncFailureDetail === 'function' ? socket.ncFailureDetail() : Promise.resolve(null);
    detail.then((text) => {
      if (!res.headersSent && !res.writableEnded) sendMuseProxyError(res, 502, 'muse_connection_failed', text);
    });
  });
  res.once('close', () => {
    clearTimeout(timer);
    upstream.destroy();
  });
  upstream.end();
}

function checkMuseHealth(req, res, connect = connectMuse, timeoutMs = MUSE_HEALTH_TIMEOUT_MS) {
  relayMuseGet(req, res, { node: 'muse-vm', path: '/health', connect, timeoutMs, passAuthorization: false });
}

// /admin/muse/<ノード>/<health|nix>。外向き専用muse宛や未知のパスは接続前に拒否する。
function relayMuseNode(req, res, connect = () => connectMuse(), nixTimeoutMs = MUSE_NIX_TIMEOUT_MS) {
  const match = req.url.match(MUSE_NODE_ROUTE);
  if (!match) {
    req.resume();
    sendMuseProxyError(res, 404, 'not_found');
    return;
  }
  const [, node, target] = match;
  relayMuseGet(req, res, {
    node,
    path: target === 'nix' ? MUSE_NIX_PATH : '/health',
    connect: () => connect(node),
    timeoutMs: target === 'nix' ? nixTimeoutMs : MUSE_HEALTH_TIMEOUT_MS,
    passAuthorization: target === 'nix',
  });
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
    if (req.url === MUSE_PROXY_PATH) {
      forwardToMuse(req, res);
      return;
    }
    if (req.url === MUSE_HEALTH_PATH) {
      checkMuseHealth(req, res);
      return;
    }
    if (req.url.startsWith('/admin/muse/')) {
      relayMuseNode(req, res);
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
    if (req.method === 'POST' && req.url === '/t3/session') {
      issueT3Session().then((result) => {
        res.writeHead(result.ok ? 200 : 502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(result));
      });
      return;
    }
    if (req.method === 'POST' && req.url === '/t3/pairing') {
      issueT3Pairing().then((result) => {
        res.writeHead(result.ok ? 200 : 502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(result));
      });
      return;
    }
    if (req.url === '/health/t3') {
      collectT3Health().then((t3) => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(t3));
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
  ;

module.exports = { forwardToMuse, checkMuseHealth, connectMuse, relayMuseNode, MUSE_NODE_ROUTE, MUSE_NC_ARGS, MUSE_MAX_BODY, readHostKeys, issueT3Pairing, T3_PAIRING_ARGS, issueT3Session, T3_SESSION_ARGS, judgeT3Health, parseCodexLoginStatus, parseListenAddresses, collectT3Health, summarizeTailscalePeers, extractVersion, compareVersions, judgeVersion, parseAptCandidate, judgeAptVersion, VERSION_SOURCES, APT_TOOLS };

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
