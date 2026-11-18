import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

// 対象: 本体コンテナで lib(nekoserver/lib)のSSIを、管理者だけが本体ワーカー経由で見られるようにする(ユーザー指定、2026-11-11「管理者だけ」)。
// 経路: Worker /cf-containers/proxy/lib/...(authMiddleware + cfDashboardAdminMiddleware)→ server.js(8080)→ Apache 127.0.0.1:8445 → /var/www/html/lib のSSI。
// 故障想定: 公開の8443(Cloudflare Tunnel)からlibが見える / 内部の受け口が外から届く / 中継でパスやクエリ・メソッド・本文が変わる /
// 上流が落ちたときに理由が返らない / /root/lib が再起動のたびに見えなくなる / bind mountの失敗で起動が止まる。

const require = createRequire(import.meta.url);
const server = require('../containers/demo/server.js');
const dockerfile = readFileSync('containers/demo/Dockerfile', 'utf8');
const entrypoint = readFileSync('containers/demo/entrypoint.sh', 'utf8');
const demoConf = readFileSync('containers/demo/apache-demo.conf', 'utf8');
const libConf = readFileSync('containers/demo/apache-lib.conf', 'utf8');
const serverJs = readFileSync('containers/demo/server.js', 'utf8');

describe('公開の8443(Cloudflare Tunnel)からはlibを見せない', () => {
  it('8443のVirtualHostで/libを拒否する(debug・adminと同じ扱い)', () => {
    const match = demoConf.match(/<LocationMatch "([^"]+)">\s*Require all denied\s*<\/LocationMatch>/);
    expect(match).not.toBeNull();
    const re = new RegExp(match![1]);
    for (const path of ['/lib', '/lib/', '/lib/muse/dashboard/index.shtml', '/lib/api/chat/ws', '/debug', '/admin/x']) expect(re.test(path), path).toBe(true);
    for (const path of ['/library', '/', '/cf-containers', '/t3/']) expect(re.test(path), path).toBe(false);
  });
});

describe('内部専用の受け口(127.0.0.1:8445)', () => {
  it('127.0.0.1だけで待ち受け、/var/www/html/libのSSIを手元からだけ許す', () => {
    expect(libConf).toMatch(/^Listen 127\.0\.0\.1:8445$/m);
    expect(libConf).toContain('<VirtualHost 127.0.0.1:8445>');
    expect(libConf).not.toMatch(/^Listen (?!127\.0\.0\.1:)/m);
    expect(libConf).toMatch(/<Directory \/var\/www\/html\/lib>[\s\S]*Options \+Includes[\s\S]*Require local[\s\S]*<\/Directory>/);
    expect(libConf).toContain('AddOutputFilter INCLUDES .shtml');
    expect(libConf).not.toContain('IncludesNoExec');
  });
  it('SSIの#execとCGI(.cgi)を実行できる', () => {
    const dir = libConf.match(/<Directory \/var\/www\/html\/lib>([\s\S]*?)<\/Directory>/)![1];
    expect(dir).toMatch(/Options \+Includes \+ExecCGI/);
    expect(dir).toContain('AddHandler cgi-script .cgi');
    expect(dockerfile).toMatch(/a2enmod [^\n]*\bcgid\b[^\n]*\binclude\b/);
  });
  it('Dockerfileが設定を置いて有効にする', () => {
    expect(dockerfile).toContain('COPY apache-lib.conf /etc/apache2/sites-available/010-lib.conf');
    expect(dockerfile).toMatch(/a2ensite 000-demo[\s\S]*a2ensite 010-lib|a2ensite 000-demo 010-lib/);
  });
});

// 対象: tree-viewのワーカータブ(dynamicneko → 本体 /api/tree-view/conversation-stream-external/lib/* → server.js → 8445)の会話ストリーム。
// 2026-11-13の修正はこの中継を前提にしたが、作業ツリーの未コミットの変更のままで、11-13以降にDockerfileから作ったイメージには無かった
// (2026-11-18、8445で /lib/api/chat/session が404、/lib/conversation-embed.html は8092を通らない静的なファイルだった)。
// 故障想定: 中継が無く会話のセッション・ストリームが404になる / 静的な埋め込みページが認証なしで返る / Hostが書き換わりlibのorigin照合が403になる /
// 中継先がloopbackの外になる / 待ち受けが127.0.0.1の外に広がる。
describe('内部の受け口(8445)は、会話ストリームの経路だけをlibのストリームのサーバーへ中継する', () => {
  const proxies = [...libConf.matchAll(/^\s*ProxyPass (\S+) (\S+)/gm)].map((m) => [m[1], m[2]]);
  it('会話ストリームの4経路を、127.0.0.1の8091(WebSocket)・8092(HTTP)へ中継する', () => {
    expect(proxies).toEqual(expect.arrayContaining([
      ['/lib/api/chat/ws', 'ws://127.0.0.1:8091/lib/api/chat/ws'],
      ['/lib/api/chat/', 'http://127.0.0.1:8092/lib/api/chat/'],
      ['/lib/conversation-embed.html', 'http://127.0.0.1:8092/lib/conversation-embed.html'],
      ['/lib/chat/', 'http://127.0.0.1:8092/lib/chat/'],
      ['/lib/t/', 'http://127.0.0.1:8092/lib/t/'],
    ]));
  });
  it('WebSocketの規則を、より短い /lib/api/chat/ の規則より前に置く(ProxyPassは先に一致したものを使う)', () => {
    const order = proxies.map(([path]) => path);
    expect(order.indexOf('/lib/api/chat/ws')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('/lib/api/chat/ws')).toBeLessThan(order.indexOf('/lib/api/chat/'));
  });
  it('中継先はloopbackだけで、それ以外の/libは中継しない', () => {
    for (const [path, target] of proxies) {
      expect(target, path).toMatch(/^(?:ws|http):\/\/127\.0\.0\.1:(?:8091|8092)\//);
      expect(path, path).toMatch(/^\/lib\/(?:api\/chat\/|conversation-embed\.html$|chat\/$|t\/$)/);
    }
  });
  it('Hostを保つ(libのセッションはHostからHTTPSのoriginを導く。書き換えると認証後の確認が403になる)', () => {
    expect(libConf).toMatch(/^\s*ProxyPreserveHost On$/m);
  });
  it('中継に要るモジュールをDockerfileが有効にする', () => {
    expect(dockerfile).toMatch(/a2enmod [^\n]*\bproxy_http\b[^\n]*\bproxy_wstunnel\b/);
  });
});

describe('server.jsが/libを127.0.0.1:8445へ中継する', () => {
  const servers: http.Server[] = [];
  afterEach(() => { for (const s of servers.splice(0)) s.close(); });
  const listen = (handler: http.RequestListener) => new Promise<number>((resolve) => {
    const s = http.createServer(handler);
    servers.push(s);
    s.listen(0, '127.0.0.1', () => resolve((s.address() as AddressInfo).port));
  });

  it('/lib・/lib/...・/lib?...を中継の対象にし、/libraryは対象にしない', () => {
    for (const url of ['/lib', '/lib/', '/lib/muse/dashboard/index.shtml', '/lib?x=1']) expect(server.isLibPath(url), url).toBe(true);
    for (const url of ['/library', '/', '/redmine', '/lib-x']) expect(server.isLibPath(url), url).toBe(false);
    expect(serverJs).toMatch(/if \(isLibPath\(req\.url\)\) \{\s*proxyToLib\(req, res\);/);
  });

  it('パス(/libを含む)・クエリ・メソッド・本文をそのまま渡し、応答の状態と本文を返す', async () => {
    const upstreamPort = await listen((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => { res.writeHead(201, { 'Content-Type': 'text/plain' }); res.end(`${req.method} ${req.url} ${body}`); });
    });
    const frontPort = await listen((req, res) => server.proxyToLib(req, res, upstreamPort));
    const res = await fetch(`http://127.0.0.1:${frontPort}/lib/tunnels.cgi?a=1&b=2`, { method: 'POST', body: 'hello' });
    expect(res.status).toBe(201);
    expect(await res.text()).toBe('POST /lib/tunnels.cgi?a=1&b=2 hello');
  });

  it('上流(Apache)に届かないときは502と理由を返す', async () => {
    const frontPort = await listen((req, res) => server.proxyToLib(req, res, 1));
    const res = await fetch(`http://127.0.0.1:${frontPort}/lib/`);
    expect(res.status).toBe(502);
    expect((await res.json() as { error: string }).error).toMatch(/libへのプロキシに失敗しました/);
  });
});

describe('entrypointが/root/libを/var/www/html/libに見せる', () => {
  const block = entrypoint.slice(entrypoint.indexOf('# --- lib(SSI)'), entrypoint.indexOf('# --- Apache'));
  it('Apacheの起動より前に、/root/libがあれば、まだマウントされていないときだけbind mountする', () => {
    expect(block.length).toBeGreaterThan(0);
    expect(entrypoint.indexOf('# --- lib(SSI)')).toBeLessThan(entrypoint.indexOf('apache2ctl configtest'));
    expect(block).toContain('if [ -d /root/lib ]');
    expect(block).toContain('mountpoint -q /var/www/html/lib');
    expect(block).toContain('mount --bind /root/lib /var/www/html/lib');
  });
  it('失敗しても起動を止めず、理由をログに残す', () => {
    expect(block).toMatch(/log "WARN: .*lib/);
    expect(block).not.toMatch(/\bexit\b/);
    expect(block).toMatch(/log ".*\/root\/lib.*無い|log ".*no \/root\/lib/);
  });
});
