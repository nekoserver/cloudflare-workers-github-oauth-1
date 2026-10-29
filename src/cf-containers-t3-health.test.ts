import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { getCfContainersPage } from './views/cfContainers';

const require = createRequire(import.meta.url);
const { judgeT3Health, parseCodexLoginStatus, parseListenAddresses, collectT3Health } = require('../containers/demo/server.js');

const GOOD = {
  server: { port: 3773, listening: true, listenAddress: '127.0.0.1', httpStatus: 200 },
  proxy: { port: 3774, listening: true, listenAddress: '127.0.0.1', httpStatus: 200, frameAncestors: 'frame-ancestors https://dynamicneko.nekoflare.workers.dev' },
  codex: { installed: true, version: '0.165.0', loggedIn: true, authFile: { exists: true, mode: '600' } },
};

describe('parseCodexLoginStatus', () => {
  it('終了コード0ならサインイン済み、1なら未サインイン', () => {
    expect(parseCodexLoginStatus(0, 'Logged in using ChatGPT').loggedIn).toBe(true);
    expect(parseCodexLoginStatus(1, 'Not logged in').loggedIn).toBe(false);
  });

  it('コマンド自体が実行できなかった場合は、サインイン済みとも未サインインとも決めない(null)', () => {
    expect(parseCodexLoginStatus(null, 'spawn codex ENOENT').loggedIn).toBeNull();
  });

  it('出力の1行目だけを返し、長いものは切り詰める(トークンらしき長い文字列を残さない)', () => {
    const r = parseCodexLoginStatus(0, `Logged in\n${'x'.repeat(500)}`);
    expect(r.summary).toBe('Logged in');
    expect(parseCodexLoginStatus(0, 'y'.repeat(500)).summary.length).toBeLessThanOrEqual(120);
  });
});

describe('parseListenAddresses', () => {
  const ss = [
    'LISTEN 0 511 127.0.0.1:3774 0.0.0.0:* users:(("node",pid=239,fd=21))',
    'LISTEN 0 511 127.0.0.1:3773 0.0.0.0:* users:(("node",pid=269,fd=23))',
    'LISTEN 0 128 0.0.0.0:2222 0.0.0.0:*',
    'LISTEN 0 4096 [::]:8443 [::]:*',
  ].join('\n');

  it('ポートごとの待ち受けアドレスを取り出す', () => {
    const m = parseListenAddresses(ss);
    expect(m['3773']).toBe('127.0.0.1');
    expect(m['3774']).toBe('127.0.0.1');
    expect(m['2222']).toBe('0.0.0.0');
    expect(m['8443']).toBe('[::]');
  });

  it('空の出力なら空のオブジェクト', () => {
    expect(parseListenAddresses('')).toEqual({});
  });
});

describe('judgeT3Health', () => {
  it('すべて揃っていれば ready', () => {
    const r = judgeT3Health(GOOD);
    expect(r.state).toBe('ready');
    expect(r.reasons).toEqual([]);
  });

  it('T3本体(3773)が待ち受けていなければ server-down', () => {
    const r = judgeT3Health({ ...GOOD, server: { ...GOOD.server, listening: false, httpStatus: null } });
    expect(r.state).toBe('server-down');
    expect(r.reasons.join(' ')).toContain('3773');
  });

  it('T3本体は待ち受けているがHTTPが2xxでなければ server-error', () => {
    const r = judgeT3Health({ ...GOOD, server: { ...GOOD.server, httpStatus: 500 } });
    expect(r.state).toBe('server-error');
  });

  it('中継(3774)が待ち受けていなければ proxy-down', () => {
    const r = judgeT3Health({ ...GOOD, proxy: { ...GOOD.proxy, listening: false, httpStatus: null } });
    expect(r.state).toBe('proxy-down');
    expect(r.reasons.join(' ')).toContain('3774');
  });

  it('codexが入っていなければ codex-missing', () => {
    const r = judgeT3Health({ ...GOOD, codex: { ...GOOD.codex, installed: false, version: null, loggedIn: null } });
    expect(r.state).toBe('codex-missing');
  });

  it('Codexが未サインインなら login-required(T3が動いていても ready にしない)', () => {
    const r = judgeT3Health({ ...GOOD, codex: { ...GOOD.codex, loggedIn: false } });
    expect(r.state).toBe('login-required');
  });

  it('サインイン状態を確かめられなかった場合は login-unknown(ready にしない)', () => {
    const r = judgeT3Health({ ...GOOD, codex: { ...GOOD.codex, loggedIn: null } });
    expect(r.state).toBe('login-unknown');
  });

  it('3773/3774がloopback以外で待ち受けていると exposed(外から届く状態)', () => {
    const r = judgeT3Health({ ...GOOD, server: { ...GOOD.server, listenAddress: '0.0.0.0' } });
    expect(r.state).toBe('exposed');
  });

  it('auth.jsonの権限が600でなければ警告(reasons)に出すが、stateは変えない', () => {
    const r = judgeT3Health({ ...GOOD, codex: { ...GOOD.codex, authFile: { exists: true, mode: '644' } } });
    expect(r.state).toBe('ready');
    expect(r.reasons.join(' ')).toContain('600');
  });

  it('待ち受けアドレスを確認できなかった(ssが使えない等)ときは、確認できなかったことを理由に出す', () => {
    const r = judgeT3Health({ ...GOOD, server: { ...GOOD.server, listenAddress: null }, proxy: { ...GOOD.proxy, listenAddress: null } });
    expect(r.reasons.join(' ')).toContain('待ち受けアドレス');
  });

  it('フィールドが欠けていても例外にならず、ready にならない', () => {
    expect(() => judgeT3Health({})).not.toThrow();
    expect(judgeT3Health({}).state).not.toBe('ready');
  });
});

describe('collectT3Health', () => {
  const deps = (over: Record<string, unknown> = {}) => ({
    probeTcp: async () => true,
    httpGet: async (port: number) => ({ status: 200, headers: port === 3774 ? { 'content-security-policy': 'frame-ancestors https://x' } : {}, body: '{"label":"x","version":"1"}' }),
    runCmd: async (cmd: string, args: string[]) => {
      if (cmd === 'codex' && args[0] === '--version') return { code: 0, out: 'codex-cli 0.165.0' };
      if (cmd === 'codex') return { code: 0, out: 'Logged in using ChatGPT' };
      if (cmd === 'ss') return { code: 0, out: 'LISTEN 0 511 127.0.0.1:3773 0.0.0.0:*\nLISTEN 0 511 127.0.0.1:3774 0.0.0.0:*' };
      return { code: null, out: '' };
    },
    statFile: async () => ({ exists: true, mode: '600' }),
    ...over,
  });

  it('各プローブの結果を集めて、判定まで含めて返す', async () => {
    const r = await collectT3Health(deps());
    expect(r.server.port).toBe(3773);
    expect(r.proxy.port).toBe(3774);
    expect(r.codex.version).toBe('0.165.0');
    expect(r.state).toBe('ready');
  });

  it('プローブが例外を投げても、収集全体は落ちず、その項目を失敗として返す', async () => {
    const r = await collectT3Health(deps({ httpGet: async () => { throw new Error('boom'); } }));
    expect(r.server.httpStatus).toBeNull();
    expect(r.state).not.toBe('ready');
    expect(JSON.stringify(r)).toContain('boom');
  });

  it('auth.jsonの中身(トークン)を結果に含めない', async () => {
    const r = await collectT3Health(deps({ statFile: async () => ({ exists: true, mode: '600', content: 'SECRET-TOKEN' }) }));
    expect(JSON.stringify(r)).not.toContain('SECRET-TOKEN');
  });
});

describe('server.js の配線', () => {
  it('専用の /health/t3 で結果を返し、既存の /health は遅くしない(t3を含めない)', () => {
    const s = readFileSync('containers/demo/server.js', 'utf-8');
    expect(s).toMatch(/req\.url === '\/health\/t3'/);
    const i = s.indexOf('async function buildHealth()');
    const body = s.slice(i, s.indexOf('\n}\n', i));
    expect(body).not.toContain('collectT3Health');
  });
});

describe('/cf-containers ページの T3 セクション', () => {
  const html = getCfContainersPage();

  it('T3セクションと確認ボタンがある', () => {
    expect(html).toContain('id="section-t3"');
    expect(html).toContain('id="btn-t3-health"');
  });

  it('ポート番号(3773・3774)を表示する', () => {
    const idx = html.indexOf('id="section-t3"');
    const section = html.slice(idx, idx + 4000);
    expect(section).toContain('3773');
    expect(section).toContain('3774');
  });

  it('好ましい状態(ready)の条件をページに書いている', () => {
    const idx = html.indexOf('id="section-t3"');
    expect(html.slice(idx, idx + 4000)).toContain('codex login status');
  });

  it('確認ボタンは /cf-containers/proxy/health/t3 を読む', () => {
    expect(html).toMatch(/btn-t3-health/);
    expect(html).toContain('/cf-containers/proxy/health/t3');
  });

  it('埋め込みscriptがJavaScriptとして構文エラーにならない', () => {
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    for (const src of scripts) expect(() => new Function(src)).not.toThrow();
  });
});

// ページに埋め込まれた実コードから関数を取り出して実行する(写しを別に書いて通すだけのテストにしない)。
function loadPageFunction<T>(name: string): T {
  const html = getCfContainersPage();
  const start = html.indexOf(`function ${name}(`);
  expect(start, `${name} がページに無い`).toBeGreaterThan(-1);
  let depth = 0;
  let end = -1;
  for (let i = html.indexOf('{', start); i < html.length; i++) {
    if (html[i] === '{') depth++;
    if (html[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  return new Function(`${html.slice(start, end)}; return ${name};`)() as T;
}

describe('summarizeTailscaleSession(ページ内)', () => {
  type Summary = { ok: boolean | null; label: string; detail: string };
  const summarize = () => loadPageFunction<(d: unknown) => Summary>('summarizeTailscaleSession');
  const running = {
    backendState: 'Running',
    self: { hostName: 'cf-demo-container', dnsName: 'cf-demo-container.taile4e096.ts.net.', ip: '100.76.177.54' },
    peers: [
      { hostName: 'phone', online: true, active: true, connection: 'direct' },
      { hostName: 'laptop', online: true, active: false, connection: 'relay' },
      { hostName: 'old', online: false, active: false, connection: 'none' },
    ],
  };

  it('Running ならOK。自分のノードと、相手の数・接続経路の内訳を出す', () => {
    const r = summarize()(running);
    expect(r.ok).toBe(true);
    expect(r.label).toContain('Running');
    expect(r.detail).toContain('100.76.177.54');
    expect(r.detail).toContain('3');
    expect(r.detail).toContain('直接');
    expect(r.detail).toContain('中継');
  });

  it('Running 以外(NeedsLogin など)はNGにして、状態名をそのまま出す', () => {
    const r = summarize()({ ...running, backendState: 'NeedsLogin' });
    expect(r.ok).toBe(false);
    expect(r.label).toContain('NeedsLogin');
  });

  it('エラー応答(tailscaledが落ちている等)はNGにして、理由を出す(空にしない)', () => {
    const r = summarize()({ error: 'tailscale status --json を読めません(tailscaledが起動していない可能性)' });
    expect(r.ok).toBe(false);
    expect(r.detail).toContain('tailscaled');
  });

  it('応答が取れなかった(null)場合は、OKにもNGにも決めない(null)', () => {
    const r = summarize()(null);
    expect(r.ok).toBeNull();
    expect(r.detail).not.toBe('');
  });

  it('相手が0件でも例外にならない', () => {
    expect(() => summarize()({ ...running, peers: [] })).not.toThrow();
  });
});

describe('/cf-containers ページの Tailscale 表示', () => {
  const html = getCfContainersPage();

  it('T3セクションに Tailscale の行があり、既存の /debug/tailscale-peers を使う', () => {
    const idx = html.indexOf('id="section-t3"');
    expect(html.slice(idx, idx + 5000)).toContain('Tailscale');
    expect(html).toContain('/cf-containers/proxy/debug/tailscale-peers');
  });
});
