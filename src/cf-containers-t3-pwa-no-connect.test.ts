import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// 「開発用PWAのT3に接続」の画面は、承認しても先へ進まなかったため出さない。
// セッションが無いときは、T3の標準のログイン(ペアリング)画面へ進む。
// 実際のクライアントコード(t3-pwa-client.js)の start() を、スタブしたブラウザ環境で動かして確かめる。
const CLIENT = '../containers/demo/t3-pwa-client.js';
let entryCount = 0;
// 読み込みのたびに別の識別子を付ける(同じ読み込み先は、一度しか実行されないため)。
const entry = () => `data:text/javascript,globalThis.__t3NativeLoaded=(globalThis.__t3NativeLoaded||0)+1;//${++entryCount}`;

type Fetched = { url: string; method: string; authorization: string | null; transportInstalled: boolean };
type Mode = boolean | 'network-error' | 'server-error';
const BEARER = { token: 'stored-bearer-token', expires: Math.floor(Date.now() / 1000) + 3600 };

function installBrowser(authenticated: Mode, standalone = true, storedBearer: typeof BEARER | null = null) {
  const fetched: Fetched[] = [];
  const created: string[] = [];
  const removed: string[] = [];
  const store = () => ({ getItem: (key: string) => (storedBearer && key === 't3:pwa-native-session:v1' ? JSON.stringify(storedBearer) : null), setItem: () => {}, removeItem: (key: string) => { removed.push(key); } });
  const element = (tag: string) => {
    created.push(tag);
    return { tag, append() {}, replaceChildren() {}, addEventListener() {}, setAttribute() {}, remove() {}, style: {}, dataset: {}, hidden: false };
  };
  const fetchStub = vi.fn(async (input: unknown, init?: { method?: string; headers?: HeadersInit }) => {
    const url = typeof input === 'string' ? input : (input as { url: string }).url;
    const headers = new Headers(init?.headers ?? (input as { headers?: HeadersInit }).headers);
    fetched.push({ url, method: init?.method ?? 'GET', authorization: headers.get('authorization'), transportInstalled: win.fetch !== fetchStub });
    if (url.includes('/api/auth/session')) {
      if (authenticated === 'network-error') throw new TypeError('Failed to fetch');
      if (authenticated === 'server-error') return new Response('boom', { status: 500 });
      return new Response(JSON.stringify({ authenticated }), { status: 200 });
    }
    if (url.includes('/_t3/pwa/verified')) return new Response(JSON.stringify({ verified: true }), { status: 200 });
    return new Response(JSON.stringify({ error: 'unexpected' }), { status: 500 });
  });
  const win: Record<string, unknown> = {
    fetch: fetchStub,
    matchMedia: () => ({ matches: standalone }),
    addEventListener() {},
    removeEventListener() {},
    WebSocket: class {},
  };
  win.top = win;
  const doc = { getElementById: () => null, createElement: element, head: { append() {} }, body: { append() {} }, addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' };
  // ブラウザーのRequestは相対URLを基準URLで解決する。Nodeのものは解決しないので、同じ挙動のスタブにする。
  vi.stubGlobal('Request', class { url: string; headers: Headers; constructor(input: unknown, init?: { headers?: HeadersInit }) { this.url = new URL(typeof input === 'string' ? input : (input as { url: string }).url, 'https://t3.example.test/').href; this.headers = new Headers(init?.headers); } });
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  vi.stubGlobal('navigator', { standalone });
  vi.stubGlobal('location', { pathname: '/', href: 'https://t3.example.test/', origin: 'https://t3.example.test', protocol: 'https:', host: 't3.example.test', reload() {} });
  vi.stubGlobal('localStorage', store());
  vi.stubGlobal('sessionStorage', store());
  return { fetched, created, removed, win, fetchStub };
}

beforeEach(() => {
  vi.resetModules();
  (globalThis as { __t3NativeLoaded?: number }).__t3NativeLoaded = 0;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('t3-pwa-client.js start()', () => {
  it('セッションが無いPWAでは、接続ページを出さず、申請も作らず、T3の標準画面へ進む', async () => {
    const { fetched, created } = installBrowser(false);
    const { start } = await import(CLIENT);
    await start(entry());
    expect((globalThis as { __t3NativeLoaded?: number }).__t3NativeLoaded).toBe(1);
    expect(created).not.toContain('main');
    expect(fetched.some((f) => f.url.includes('/_t3/pwa/create'))).toBe(false);
    expect(fetched.some((f) => f.url.includes('/_t3/pwa/status'))).toBe(false);
  });

  it('セッションがあるPWAでは、これまでどおりT3の画面へ進む(接続ページは出ない)', async () => {
    const { created } = installBrowser(true);
    const { start } = await import(CLIENT);
    await start(entry());
    expect((globalThis as { __t3NativeLoaded?: number }).__t3NativeLoaded).toBe(1);
    expect(created).not.toContain('main');
  });

  it('通常のブラウザー(PWAでも埋め込みでもない)では、これまでどおり何も足さずにT3を開く', async () => {
    const { fetched, created } = installBrowser(false, false);
    const { start } = await import(CLIENT);
    await start(entry());
    expect((globalThis as { __t3NativeLoaded?: number }).__t3NativeLoaded).toBe(1);
    expect(created).not.toContain('main');
    expect(fetched).toHaveLength(0);
  });
});

describe('繋がらないとき', () => {
  it('ログイン状態を確認できない(通信失敗)ときも、ボタンや案内の画面を出さず、T3の標準画面へ進む', async () => {
    const { created } = installBrowser('network-error');
    const { start } = await import(CLIENT);
    await start(entry());
    expect((globalThis as { __t3NativeLoaded?: number }).__t3NativeLoaded).toBe(1);
    expect(created).not.toContain('main');
    expect(created).not.toContain('button');
  });

  it('どの場合も、クライアントがボタン(再試行・新しい申請など)を作らない', async () => {
    for (const mode of [false, true, 'network-error'] as const) {
      vi.resetModules();
      const { created } = installBrowser(mode);
      const { start } = await import(CLIENT);
      await start(entry());
      expect(created).not.toContain('button');
    }
  });
});

describe('ログインの確認は、fetch・WebSocketの差し替えより前に行う', () => {
  const run = async (mode: Mode, bearer: typeof BEARER | null) => {
    const env = installBrowser(mode, true, bearer);
    const { start } = await import(CLIENT);
    await start(entry());
    return { ...env, transportInstalled: env.win.fetch !== env.fetchStub };
  };

  it('最初の通信は、T3のセッション確認で、その時点では差し替えられていない', async () => {
    for (const bearer of [null, BEARER]) {
      vi.resetModules();
      const { fetched } = await run(true, bearer);
      expect(fetched[0].url).toContain('/api/auth/session');
      expect(fetched[0].transportInstalled).toBe(false);
    }
  });

  it('保存した接続情報があるときは、その接続情報を付けて確認する', async () => {
    const { fetched } = await run(true, BEARER);
    expect(fetched[0].authorization).toBe('Bearer ' + BEARER.token);
  });

  it('接続情報が無く、未認証なら、差し替えない(通信も増やさない)', async () => {
    const { transportInstalled, fetched, removed } = await run(false, null);
    expect(transportInstalled).toBe(false);
    expect(fetched).toHaveLength(1);
    expect(removed).toEqual([]);
  });

  it('接続情報があり有効なら、確認のあとに差し替えて、接続情報の検証を完了する', async () => {
    const { transportInstalled, fetched } = await run(true, BEARER);
    expect(transportInstalled).toBe(true);
    expect(fetched.map((f) => f.url).some((u) => u.includes('/_t3/pwa/verified'))).toBe(true);
    expect((globalThis as { __t3NativeLoaded?: number }).__t3NativeLoaded).toBe(1);
  });

  it('接続情報があっても無効(未認証)なら、接続情報を捨て、差し替えずにT3の標準画面へ進む', async () => {
    const { transportInstalled, removed } = await run(false, BEARER);
    expect(removed).toContain('t3:pwa-native-session:v1');
    expect(transportInstalled).toBe(false);
    expect((globalThis as { __t3NativeLoaded?: number }).__t3NativeLoaded).toBe(1);
  });

  it('確認できない(通信失敗・サーバーエラー)ときは、接続情報を捨てない(無効とは決めない)', async () => {
    for (const mode of ['network-error', 'server-error'] as const) {
      vi.resetModules();
      const { transportInstalled, removed } = await run(mode, BEARER);
      expect(removed).toEqual([]);
      expect(transportInstalled).toBe(true);
    }
  });

  it('期限切れの接続情報は、確認に使わず捨てる', async () => {
    const expired = { token: 'old', expires: Math.floor(Date.now() / 1000) - 10 };
    const { fetched, removed } = await run(false, expired);
    expect(removed).toContain('t3:pwa-native-session:v1');
    expect(fetched[0].authorization).toBeNull();
  });
});

describe('接続ページの文言', () => {
  it('start() から connect() を呼んでいない(呼び出しが残っていない)', () => {
    const src = readFileSync('containers/demo/t3-pwa-client.js', 'utf-8');
    const i = src.indexOf('export async function start');
    expect(i).toBeGreaterThan(-1);
    expect(src.slice(i)).not.toMatch(/await connect\(/);
  });
});
