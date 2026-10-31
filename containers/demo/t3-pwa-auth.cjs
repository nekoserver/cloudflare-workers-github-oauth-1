'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execute = promisify(execFile);
const PREFIX = '/_t3/pwa';
const ORIGIN = 'https://t3.nekomaneki.work';
const SCOPES = ['orchestration:read', 'orchestration:operate', 'settings:write', 'providers:manage', 'diagnostics:read', 'terminal:read', 'terminal:operate', 'source-control:write', 'filesystem:read', 'filesystem:write', 'preview:operate'];
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const nativeBinary = '/root/.t3/runtime/versions/0.1.3/t3';
class InvalidBody extends Error {}
async function nativeCommand(args) {
  const { stdout } = await execute(nativeBinary, ['auth', 'session', ...args], { timeout: 20000, maxBuffer: 1024 * 1024 });
  return stdout;
}
// ログイン済みのブラウザのセッション(クッキー)で、T3本来のペアリングの資格情報(1回限り、5分)を発行する。
async function mintPairingCredential(cookie, label) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ label });
    const request = http.request({ hostname: '127.0.0.1', port: 3773, method: 'POST', path: '/api/auth/pairing-token', headers: { cookie, 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } }, response => {
      let text = '';
      response.on('data', chunk => { text += chunk; if (text.length > 65536) request.destroy(new Error('Oversized native response')); });
      response.on('end', () => {
        try {
          if (response.statusCode !== 200) throw new Error('Pairing credential request failed: HTTP ' + response.statusCode);
          resolve(JSON.parse(text));
        } catch (error) { reject(error); }
      });
      response.on('error', reject);
    });
    request.setTimeout(10000, () => request.destroy(new Error('Pairing credential timeout')));
    request.on('error', reject);
    request.end(payload);
  });
}
// 自動承認用: ブラウザのクッキーを使わず、コンテナ内のCLIでT3本来のペアリングの資格情報(1回限り、5分)を発行する。
// 契約(T3 0.1.3): `t3 auth pairing create --json` は {credential, expiresAt, ...} を出す。
async function mintAutoPairingCredential(label) {
  const { stdout } = await execute(nativeBinary, ['auth', 'pairing', 'create', '--json', '--label', label], { timeout: 20000, maxBuffer: 1024 * 1024, env: { ...process.env, HOME: '/root' } });
  return JSON.parse(stdout);
}
async function nativeSession(headers) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port: 3773, path: '/api/auth/session', headers }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; if (body.length > 65536) request.destroy(new Error('Oversized native response')); });
      response.on('end', () => { try { resolve(response.statusCode === 200 ? JSON.parse(body) : null); } catch (error) { reject(error); } });
      response.on('error', reject);
    });
    request.setTimeout(10000, () => request.destroy(new Error('Native session timeout')));
    request.on('error', reject);
  });
}
function respond(res, status, data, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'" });
  res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
}
// 失敗の理由と、日本語の対処。失敗のたびに、この理由のコードと対処を返し、画面にそのまま出す。
// 新しい失敗を足すときは、ここに理由と対処を足す(対処の無い理由は、テストが失敗する)。
const HANDOFF_REASONS = {
  handoff_disabled: '引き継ぎが無効です(設定ファイル /root/.t3/userdata/pwa-handoff/config.json が無いか、無効)。T3の中継を再起動すると作られます(結果は /tmp/t3-proxy.log の「T3 PWA handoff config:」の行)。',
  login_required: 'このブラウザではT3にログインしていません。このブラウザでT3を開いてログイン(ペアリング)してから、承認のリンクをもう一度開いてください。',
  pairing_mint_failed: 'T3がペアリングの資格情報を発行できませんでした。承認したブラウザのT3のログインが切れている可能性があります。PWAで再読み込みすると新しい申請を作ります(詳細は /tmp/t3.log)。',
  not_approved_yet: 'まだ承認されていません。ログイン済みのブラウザで承認のリンクを開くと承認できます。',
  expired: '申請の期限(5分)が切れました。PWAで再読み込みして、新しい申請を作ってください。',
  already_used: 'この申請はすでに使われたか、失敗しています。PWAで再読み込みして、新しい申請を作ってください。',
  rejected: '承認が拒否されました。PWAで再読み込みして、新しい申請を作ってください。',
  request_not_found: '申請が見つかりません(別の端末の申請か、T3の中継の再起動で消えました)。PWAで再読み込みして、新しい申請を作ってください。',
  t3_unreachable: 'T3本体(127.0.0.1:3773)に繋がりません(T3が起動していません。詳細は /tmp/t3.log)。',
  too_many_requests: '短い間に申請や承認が多すぎます。1分待ってから、もう一度試してください。',
  invalid_request: '要求の形が正しくありません。PWAとブラウザの両方で再読み込みしてから、もう一度試してください。',
  internal_error: '中継の中で予期しない失敗が起きました(詳細は /tmp/t3-proxy.log)。PWAで再読み込みすると新しい申請を作ります。',
};
function fail(res, status, reason, detail) {
  respond(res, status, { error: HANDOFF_REASONS[reason], reason, remedy: HANDOFF_REASONS[reason], ...(detail ? { detail: String(detail).slice(0, 300) } : {}) });
}
// 申請の状態から、受け取れない理由を決める。
function claimReason(state) {
  if (state === 'pending') return 'not_approved_yet';
  if (state === 'expired') return 'expired';
  if (state === 'rejected') return 'rejected';
  return 'already_used';
}
async function body(req) {
  if (Number(req.headers['content-length']) > 4096) throw new InvalidBody('Invalid body');
  let size = 0, chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 4096) throw new InvalidBody('Invalid body'); chunks.push(chunk); }
  let result;
  try { result = JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new InvalidBody('Invalid body'); }
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new InvalidBody('Invalid body');
  return result;
}
function injectBootstrap(html) {
  return html.replace(/<script\b([^>]*?)type="module"([^>]*?)src="(\/assets\/index-[A-Za-z0-9_-]+\.js)"([^>]*)><\/script>/,
    (_all, before, middle, entry, after) => `<script${before}type="module"${middle}src="${PREFIX}/bootstrap/${path.basename(entry)}"${after}></script>`);
}
// 引き継ぎを有効にする設定ファイル。コンテナを作り直すと ~/.t3 ごと消えるため、プロキシの起動時に、無ければ作る。
// 既にあれば(無効にした設定や壊れたファイルも)書き換えない。戻り値: 'created' | 'kept' | 'invalid'
const HANDOFF_CONFIG = '/root/.t3/userdata/pwa-handoff/config.json';
function ensureHandoffConfig(file = HANDOFF_CONFIG) {
  if (fs.existsSync(file)) {
    try { JSON.parse(fs.readFileSync(file, 'utf8')); return 'kept'; } catch { return 'invalid'; }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const value = { enabled: true, developmentOnly: true, generation: crypto.randomBytes(16).toString('hex') };
  fs.writeFileSync(file, JSON.stringify(value) + '\n', { flag: 'wx', mode: 0o600 });
  return 'created';
}
function createPwaAuth(options = {}) {
  const dbPath = options.dbPath || '/root/.t3/userdata/pwa-handoff/state.sqlite';
  if (dbPath !== ':memory:') { fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 }); }
  const db = new DatabaseSync(dbPath);
  if (dbPath !== ':memory:') fs.chmodSync(dbPath, 0o600);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS handoffs(id TEXT PRIMARY KEY, challenge TEXT NOT NULL, code TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('pending','approved','rejected','redeeming','consumed','expired','failed')), created INTEGER NOT NULL, expires INTEGER NOT NULL, ip_hash TEXT NOT NULL, approved_scopes TEXT, approved_by TEXT, approved_at INTEGER, attempt TEXT, changed INTEGER NOT NULL, actor TEXT NOT NULL, generation TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, handoff_id TEXT NOT NULL UNIQUE REFERENCES handoffs(id), token_hash TEXT NOT NULL UNIQUE, scopes TEXT NOT NULL, issued INTEGER NOT NULL, expires INTEGER NOT NULL, first_verified INTEGER, last_verified INTEGER, revoked INTEGER, CHECK(expires>issued AND expires<=issued+86405));
    CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, handoff_id TEXT NOT NULL REFERENCES handoffs(id), event TEXT NOT NULL, actor TEXT NOT NULL, occurred INTEGER NOT NULL);
    CREATE TRIGGER IF NOT EXISTS handoff_insert AFTER INSERT ON handoffs BEGIN INSERT INTO events(handoff_id,event,actor,occurred) VALUES(NEW.id,'created',NEW.actor,NEW.changed); END;
    CREATE TRIGGER IF NOT EXISTS handoff_guard BEFORE UPDATE OF state ON handoffs WHEN NEW.state<>OLD.state BEGIN
      SELECT CASE WHEN NOT ((OLD.state='pending' AND NEW.state IN ('approved','rejected','expired')) OR (OLD.state='approved' AND NEW.state IN ('redeeming','expired')) OR (OLD.state='redeeming' AND NEW.state IN ('consumed','failed'))) THEN RAISE(ABORT,'Invalid handoff transition') END;
    END;
    CREATE TRIGGER IF NOT EXISTS handoff_update AFTER UPDATE OF state ON handoffs WHEN NEW.state<>OLD.state BEGIN INSERT INTO events(handoff_id,event,actor,occurred) VALUES(NEW.id,NEW.state,NEW.actor,NEW.changed); END;
    CREATE TRIGGER IF NOT EXISTS session_guard BEFORE INSERT ON sessions BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM handoffs WHERE id=NEW.handoff_id AND state='redeeming' AND approved_scopes=NEW.scopes) THEN RAISE(ABORT,'Session/handoff mismatch') END; END;
    CREATE TRIGGER IF NOT EXISTS session_verified AFTER UPDATE OF first_verified ON sessions WHEN OLD.first_verified IS NULL AND NEW.first_verified IS NOT NULL BEGIN INSERT INTO events(handoff_id,event,actor,occurred) VALUES(NEW.handoff_id,'native_verified','pwa',NEW.first_verified); END;
    CREATE TRIGGER IF NOT EXISTS session_revoked AFTER UPDATE OF revoked ON sessions WHEN OLD.revoked IS NULL AND NEW.revoked IS NOT NULL BEGIN INSERT INTO events(handoff_id,event,actor,occurred) VALUES(NEW.handoff_id,'revoked','recovery',NEW.revoked); END;
    CREATE INDEX IF NOT EXISTS handoff_rate ON handoffs(ip_hash,created);`);
  const origin = options.origin || ORIGIN;
  const now = options.now || (() => Math.floor(Date.now() / 1000));
  const config = options.readConfig || (() => {
    const file = '/root/.t3/userdata/pwa-handoff/config.json';
    const value = JSON.parse(fs.readFileSync(file, 'utf8')), stamp = fs.statSync(file);
    return { ...value, generation: typeof value.generation === 'string' && value.generation ? `${value.generation}:${stamp.ino}:${stamp.mtimeMs}:${stamp.ctimeMs}` : null };
  });
  function configStatus() {
    try {
      const value = config();
      if (value?.enabled === true && value.developmentOnly === true && typeof value.generation === 'string' && value.generation.length > 0) return { value };
      return { value: null, detail: 'enabled=' + String(value?.enabled) + ', developmentOnly=' + String(value?.developmentOnly) };
    } catch (error) { return { value: null, detail: error instanceof Error ? error.message : String(error) }; }
  }
  function currentConfig() { return configStatus().value; }
  const generation = options.generation || (() => {
    const id = fs.readFileSync('/root/.t3/userdata/environment-id', 'utf8').trim();
    const key = fs.statSync('/root/.t3/userdata/secrets/server-signing-key.bin');
    return sha(`${id}:${key.dev}:${key.ino}:${key.mtimeMs}:${key.ctimeMs}`);
  });
  const currentGeneration = () => generation() + ':' + (currentConfig()?.generation || 'disabled');
  const verify = options.verifySession || nativeSession;
  const mintPairing = options.mintPairing || mintPairingCredential;
  const mintAutoPairing = options.mintAutoPairing || mintAutoPairingCredential;
  // ログイン済みのブラウザを最後に見た時刻(接続元IPの署名ごと)。メモリにだけ置く。
  const AUTO_WINDOW = 300;
  const ownersSeen = new Map();
  const ipOf = req => sign(req.headers['cf-connecting-ip'] || req.socket.remoteAddress || 'unknown');
  function noteOwner(req) {
    const t = now(); ownersSeen.set(ipOf(req), t);
    for (const [key, seen] of ownersSeen) if (seen <= t - AUTO_WINDOW) ownersSeen.delete(key);
  }
  // 発行したペアリングの資格情報は、データベースに保存せず、このプロセスのメモリにだけ置く(受け取りで消す)。
  const pairings = new Map();
  const issue = options.issueSession || (async (id, scopes) => {
    const args = ['issue', '--ttl', '24h', '--label', 'tree-view-pwa:' + id, '--subject', 'tree-view-pwa', '--json'];
    for (const scope of scopes) args.push('--scope', scope);
    return JSON.parse(await nativeCommand(args));
  });
  const revoke = options.revokeSession || (async id => { await nativeCommand(['revoke', id]); });
  const list = options.listSessions || (async () => JSON.parse(await nativeCommand(['list', '--json'])));
  const keyPath = dbPath + '.csrf-key';
  let key = options.key;
  if (!key) {
    try { key = fs.readFileSync(keyPath); }
    catch (error) { if (error.code !== 'ENOENT') throw error; key = crypto.randomBytes(32); fs.writeFileSync(keyPath, key, { flag: 'wx', mode: 0o600 }); }
  }
  const sign = value => crypto.createHmac('sha256', key).update(value).digest('hex');
  const csrf = (id, cookie, expiry) => sign(`${id}:${sha(cookie)}:${expiry}`);
  const query = id => db.prepare('SELECT * FROM handoffs WHERE id=?').get(id);
  function expire(row) {
    if (row && (row.expires <= now() || row.generation !== currentGeneration()) && ['pending', 'approved'].includes(row.state)) {
      db.prepare("UPDATE handoffs SET state='expired',changed=?,actor='expiry' WHERE id=? AND state IN ('pending','approved')").run(now(), row.id);
      return query(row.id);
    }
    return row;
  }
  function device(data) {
    if (typeof data.id !== 'string' || !/^[a-f0-9]{32}$/.test(data.id) || typeof data.secret !== 'string' || !/^[a-f0-9]{64}$/.test(data.secret)) return null;
    const row = expire(query(data.id));
    return row && equal(row.challenge, sha(data.secret)) ? row : null;
  }
  async function owner(req) {
    const cookie = req.headers.cookie || '';
    if (!cookie) return null;
    const session = await verify({ cookie });
    if (!session?.authenticated || session.sessionMethod !== 'browser-session-cookie' || !Array.isArray(session.scopes)) return null;
    // Read-only credentials must not acquire a new, independently-lived session.
    // Native T3 documents terminal/agent operation as administrative-equivalent:
    // either can already issue native sessions through the local CLI.
    if (!['access:write', 'terminal:operate', 'orchestration:operate'].some(scope => session.scopes.includes(scope))) return null;
    const scopes = SCOPES.filter(scope => session.scopes.includes(scope));
    if (!scopes.includes('orchestration:read')) return null;
    const name = session.auth?.sessionCookieName;
    if (typeof name !== 'string' || !/^[A-Za-z0-9_]+$/.test(name)) return null;
    const nativeCookie = cookie.split(';').map(value => value.trim()).find(value => value.startsWith(name + '='));
    if (!nativeCookie) return null;
    return { cookie: nativeCookie, scopes, actor: sign(nativeCookie) };
  }
  let recovering = false;
  async function recover() {
    if (recovering) return;
    recovering = true;
    try {
      const abandoned = db.prepare("SELECT id FROM handoffs WHERE state='redeeming' AND changed<=?").all(now() - 60);
      if (abandoned.length) {
        const native = await list();
        for (const row of abandoned) {
          for (const session of native.filter(item => item.client?.label === 'tree-view-pwa:' + row.id)) await revoke(session.sessionId);
          db.prepare("UPDATE handoffs SET state='failed',changed=?,actor='recovery' WHERE id=? AND state='redeeming'").run(now(), row.id);
        }
      }
      for (const session of db.prepare('SELECT id FROM sessions WHERE first_verified IS NULL AND revoked IS NULL AND issued<=?').all(now() - 300)) {
        await revoke(session.id);
        db.prepare('UPDATE sessions SET revoked=? WHERE id=? AND revoked IS NULL').run(now(), session.id);
      }
    } finally { recovering = false; }
  }
  async function handle(req, res) {
    const url = new URL(req.url, origin);
    if (!url.pathname.startsWith(PREFIX + '/')) return false;
    try {
      if (req.method === 'GET' && url.pathname === PREFIX + '/client.js') {
        respond(res, 200, fs.readFileSync(path.join(__dirname, 't3-pwa-client.js'), 'utf8'), 'text/javascript; charset=utf-8'); return true;
      }
      if (req.method === 'GET' && url.pathname === PREFIX + '/client.css') {
        respond(res, 200, fs.readFileSync(path.join(__dirname, 't3-pwa-client.css'), 'utf8'), 'text/css; charset=utf-8'); return true;
      }
      const bootstrapFile = url.pathname.match(/^\/_t3\/pwa\/bootstrap\/(index-[A-Za-z0-9_-]+\.js)$/)?.[1];
      if (req.method === 'GET' && (bootstrapFile || url.pathname === PREFIX + '/bootstrap.js')) {
        // Some ingress paths omit the HTTP query string. New HTML uses a
        // versioned path; retain the first release's URL until clients reload.
        const entry = bootstrapFile ? '/assets/' + bootstrapFile : url.searchParams.get('entry') || fs.readFileSync(path.join(path.dirname(nativeBinary), 'client/index.html'), 'utf8').match(/src="(\/assets\/index-[A-Za-z0-9_-]+\.js)"/)?.[1];
        if (!entry || !/^\/assets\/index-[A-Za-z0-9_-]+\.js$/.test(entry)) { respond(res, 400, { error: 'Invalid entry' }); return true; }
        respond(res, 200, `import {start} from '${PREFIX}/client.js'; await start(${JSON.stringify(entry)});`, 'text/javascript; charset=utf-8'); return true;
      }
      if (req.method === 'GET' && /^\/_t3\/pwa\/approve\/[a-f0-9]{32}$/.test(url.pathname)) {
        respond(res, 200, '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>T3 PWAの承認</title><body><main id="pwa-connect"><p>ログインを確認しています…</p></main><script type="module" src="/_t3/pwa/client.js"></script></body></html>', 'text/html; charset=utf-8'); return true;
      }
      // 診断: 項目ごとに ok と、だめなら理由と対処を返す。クッキーや資格情報などの秘密は返さない。
      if (req.method === 'GET' && url.pathname === PREFIX + '/diagnose') {
        const checks = [];
        const cfg = configStatus();
        checks.push(cfg.value ? { name: '引き継ぎの設定', ok: true } : { name: '引き継ぎの設定', ok: false, reason: 'handoff_disabled', remedy: HANDOFF_REASONS.handoff_disabled, detail: cfg.detail });
        let reachable = false;
        try {
          const state = await verify({});
          reachable = !!state;
          checks.push(state ? { name: 'T3本体', ok: true } : { name: 'T3本体', ok: false, reason: 't3_unreachable', remedy: HANDOFF_REASONS.t3_unreachable, detail: 'T3が /api/auth/session に200以外を返しました' });
        } catch (error) {
          checks.push({ name: 'T3本体', ok: false, reason: 't3_unreachable', remedy: HANDOFF_REASONS.t3_unreachable, detail: error instanceof Error ? error.message : String(error) });
        }
        const account = reachable ? await owner(req).catch(() => null) : null;
        checks.push(account ? { name: 'このブラウザのT3のログイン', ok: true } : { name: 'このブラウザのT3のログイン', ok: false, reason: 'login_required', remedy: HANDOFF_REASONS.login_required });
        const counts = db.prepare('SELECT state, count(*) AS n FROM handoffs WHERE created>? GROUP BY state').all(now() - 3600);
        checks.push({ name: '最近の申請', ok: true, detail: counts.length ? counts.map(row => row.state + ' ' + row.n + '件').join('、') : '直近1時間の申請はありません' });
        respond(res, 200, { checks }); return true;
      }
      const approvalId = url.pathname.match(/^\/_t3\/pwa\/approval\/([a-f0-9]{32})$/)?.[1];
      if (approvalId && req.method === 'GET') {
        const account = await owner(req); if (!account) { fail(res, 401, 'login_required'); return true; }
        const row = expire(query(approvalId)); if (!row) { fail(res, 404, 'request_not_found'); return true; }
        respond(res, 200, { code: row.code, state: row.state, expires: row.expires, scopes: account.scopes, csrf: csrf(row.id, account.cookie, row.expires) }); return true;
      }
      if (req.method !== 'POST') { fail(res, 405, 'invalid_request'); return true; }
      if (req.headers.origin !== origin) { fail(res, 403, 'invalid_request', 'Origin not allowed'); return true; }
      if (!currentConfig() && (approvalId || [PREFIX + '/create', PREFIX + '/claim'].includes(url.pathname))) {
        db.prepare("UPDATE handoffs SET state='expired',changed=?,actor='disabled' WHERE state IN ('pending','approved')").run(now());
        fail(res, 503, 'handoff_disabled', configStatus().detail); return true;
      }
      if (approvalId) {
        const account = await owner(req); if (!account) { fail(res, 401, 'login_required'); return true; }
        const data = await body(req); const row = expire(query(approvalId));
        if (!row || !equal(req.headers['x-csrf-token'], csrf(row.id, account.cookie, row.expires)) || !['approve', 'reject'].includes(data.decision)) { fail(res, row ? 403 : 404, row ? 'invalid_request' : 'request_not_found'); return true; }
        const count = db.prepare("SELECT count(*) AS n FROM events WHERE actor=? AND event IN ('approved','rejected') AND occurred>?").get(account.actor, now() - 60).n;
        if (count >= 10) { fail(res, 429, 'too_many_requests'); return true; }
        const next = data.decision === 'approve' ? 'approved' : 'rejected';
        const changed = db.prepare("UPDATE handoffs SET state=?,approved_scopes=?,approved_by=?,approved_at=?,changed=?,actor=? WHERE id=? AND state='pending' AND expires>?").run(next, JSON.stringify(account.scopes), account.actor, now(), now(), account.actor, row.id, now()).changes;
        if (changed !== 1) { fail(res, 409, claimReason(expire(query(row.id))?.state)); return true; }
        if (next === 'approved') {
          try {
            const issued = await mintPairing(account.cookie, 'tree-view-pwa:' + row.id);
            const expires = Math.min(row.expires, Math.floor(Date.parse(issued?.expiresAt) / 1000));
            if (typeof issued?.credential !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(issued.credential) || !Number.isFinite(expires) || expires <= now()) throw new Error('Invalid pairing credential');
            pairings.set(row.id, { credential: issued.credential, expires });
          } catch (error) {
            // 状態の遷移の規則(approved -> redeeming -> failed)に従って、失敗として残す。
            db.prepare("UPDATE handoffs SET state='redeeming',changed=?,actor='approval' WHERE id=? AND state='approved'").run(now(), row.id);
            db.prepare("UPDATE handoffs SET state='failed',changed=?,actor='approval' WHERE id=? AND state='redeeming'").run(now(), row.id);
            fail(res, 503, 'pairing_mint_failed', error instanceof Error ? error.message : error); return true;
          }
        }
        respond(res, 200, { state: next }); return true;
      }
      const data = await body(req);
      if (url.pathname === PREFIX + '/create') {
        if (typeof data.secret !== 'string' || !/^[a-f0-9]{64}$/.test(data.secret)) { fail(res, 400, 'invalid_request'); return true; }
        const ip = ipOf(req);
        if (db.prepare('SELECT count(*) AS n FROM handoffs WHERE ip_hash=? AND created>?').get(ip, now() - 60).n >= 5) { fail(res, 429, 'too_many_requests'); return true; }
        const id = crypto.randomBytes(16).toString('hex'), code = crypto.randomBytes(4).toString('hex').toUpperCase();
        db.prepare("INSERT INTO handoffs(id,challenge,code,state,created,expires,ip_hash,changed,actor,generation) VALUES(?,?,?,'pending',?,?,?,?,'pwa',?)").run(id, sha(data.secret), code, now(), now() + 300, ip, now(), currentGeneration());
        // 同じ接続元で5分以内にログイン済みのブラウザを見ていれば、承認ボタンを待たずに自動で承認する。
        let autoApproval;
        const seen = ownersSeen.get(ip);
        if (seen !== undefined && seen > now() - AUTO_WINDOW) {
          try {
            const issued = await mintAutoPairing('tree-view-pwa:' + id);
            const expires = Math.min(now() + 300, Math.floor(Date.parse(issued?.expiresAt) / 1000));
            if (typeof issued?.credential !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(issued.credential) || !Number.isFinite(expires) || expires <= now()) throw new Error('Invalid pairing credential');
            pairings.set(id, { credential: issued.credential, expires });
            db.prepare("UPDATE handoffs SET state='approved',approved_scopes=?,approved_by='auto-same-ip',approved_at=?,changed=?,actor='auto-same-ip' WHERE id=? AND state='pending'").run(JSON.stringify(SCOPES), now(), now(), id);
            autoApproval = { ok: true };
          } catch (error) { autoApproval = { ok: false, detail: error instanceof Error ? error.message : String(error) }; }
        }
        respond(res, 201, { id, code, expires: now() + 300, ...(autoApproval ? { autoApproval } : {}) }); return true;
      }
      if (url.pathname === PREFIX + '/verified') {
        const authorization = req.headers.authorization;
        if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) { respond(res, 401, { error: 'Unauthorized' }); return true; }
        const session = await verify({ authorization });
        if (!session?.authenticated || session.sessionMethod !== 'bearer-access-token') { respond(res, 401, { error: 'Unauthorized' }); return true; }
        const updated = db.prepare('UPDATE sessions SET first_verified=coalesce(first_verified,?),last_verified=? WHERE token_hash=? AND expires>? AND revoked IS NULL').run(now(), now(), sha(authorization.slice(7)), now()).changes;
        respond(res, updated === 1 ? 200 : 401, { verified: updated === 1 }); return true;
      }
      const row = device(data);
      if (!row) { fail(res, 404, 'request_not_found'); return true; }
      if (url.pathname === PREFIX + '/status') { respond(res, 200, { state: row.state, code: row.code, expires: row.expires }); return true; }
      if (url.pathname !== PREFIX + '/claim') { fail(res, 404, 'invalid_request'); return true; }
      const attempt = crypto.randomUUID();
      if (db.prepare("UPDATE handoffs SET state='redeeming',attempt=?,changed=?,actor='pwa' WHERE id=? AND state='approved' AND expires>?").run(attempt, now(), row.id, now()).changes !== 1) { fail(res, 409, claimReason(expire(query(row.id))?.state)); return true; }
      const pairing = pairings.get(row.id);
      pairings.delete(row.id);
      if (!pairing || pairing.expires <= now()) {
        db.prepare("UPDATE handoffs SET state='failed',changed=?,actor='claim' WHERE id=? AND state='redeeming' AND attempt=?").run(now(), row.id, attempt);
        fail(res, 409, 'expired'); return true;
      }
      db.prepare("UPDATE handoffs SET state='consumed',changed=?,actor='claim' WHERE id=? AND state='redeeming' AND attempt=?").run(now(), row.id, attempt);
      respond(res, 200, { credential: pairing.credential });
      return true;
    } catch (error) { if (!res.headersSent) fail(res, error instanceof InvalidBody ? 400 : 503, error instanceof InvalidBody ? 'invalid_request' : 'internal_error', error instanceof Error ? error.message : error); return true; }
  }
  return { handle, recover, noteOwner, close: () => db.close(), db };
}
module.exports = { createPwaAuth, ensureHandoffConfig, HANDOFF_REASONS, injectBootstrap, nativeSession, SCOPES };
