import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// 「開発用PWAのT3に接続」の画面は、承認しても先へ進まなかったため出さない。
// セッションが無いときは、T3の標準のログイン(ペアリング)画面へ進む。
// 実際のクライアントコード(t3-pwa-client.js)の start() を、スタブしたブラウザ環境で動かして確かめる。
const CLIENT = '../containers/demo/t3-pwa-client.js';
let entryCount = 0;
// 読み込みのたびに別の識別子を付ける(同じ読み込み先は、一度しか実行されないため)。
const entry = () => `data:text/javascript,globalThis.__t3NativeLoaded=(globalThis.__t3NativeLoaded||0)+1;//${++entryCount}`;

type Fetched = { url: string; method: string };

function installBrowser(authenticated: boolean | 'network-error', standalone = true) {
  const fetched: Fetched[] = [];
  const created: string[] = [];
  const store = () => ({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
  const element = (tag: string) => {
    created.push(tag);
    return { tag, append() {}, replaceChildren() {}, addEventListener() {}, setAttribute() {}, remove() {}, style: {}, dataset: {}, hidden: false };
  };
  const fetchStub = vi.fn(async (input: unknown, init?: { method?: string }) => {
    const url = typeof input === 'string' ? input : (input as { url: string }).url;
    fetched.push({ url, method: init?.method ?? 'GET' });
    if (url.includes('/api/auth/session')) {
      if (authenticated === 'network-error') throw new TypeError('Failed to fetch');
      return new Response(JSON.stringify({ authenticated }), { status: 200 });
    }
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
  return { fetched, created };
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

describe('接続ページの文言', () => {
  it('start() から connect() を呼んでいない(呼び出しが残っていない)', () => {
    const src = readFileSync('containers/demo/t3-pwa-client.js', 'utf-8');
    const i = src.indexOf('export async function start');
    expect(i).toBeGreaterThan(-1);
    expect(src.slice(i)).not.toMatch(/await connect\(/);
  });
});
