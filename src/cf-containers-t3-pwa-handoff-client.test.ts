import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// PWA側(t3-pwa-client.js)の引き継ぎの流れを、スタブしたブラウザ環境で、実際のクライアントコードを動かして確かめる。
// 仕様(2026-10-31): セッションが無いPWAでは、引き継ぎの申請を作り、確認コードとブラウザで承認するリンクを出す。
// 承認されたら資格情報を受け取り、/#token=<資格情報> にしてからT3の画面を起動する(T3が自動でペアリングする)。
// 「トークンで入る」でいつでもT3の標準画面へ進める。申請を作れないときもT3の標準画面へ進む(行き止まりにしない)。
const CLIENT = '../containers/demo/t3-pwa-client.js';
let entryCount = 0;
const entry = () => `data:text/javascript,globalThis.__t3NativeLoaded=(globalThis.__t3NativeLoaded||0)+1;//${++entryCount}`;
const loaded = () => (globalThis as { __t3NativeLoaded?: number }).__t3NativeLoaded ?? 0;

type Node = { tag: string; textContent: string; href?: string; hidden: boolean; children: Node[]; click?: () => unknown };
type Options = { session: boolean | 'network-error'; standalone?: boolean; create?: 'ok' | 'fail'; status?: string; claim?: 'ok' | 'fail' };

function installBrowser(options: Options) {
  const { session, standalone = true, create = 'ok', status = 'approved', claim = 'ok' } = options;
  const fetched: { url: string; method: string }[] = [];
  const nodes: Node[] = [];
  const history: string[] = [];
  const element = (tag: string): Node & Record<string, unknown> => {
    const node: Node & Record<string, unknown> = {
      tag, textContent: '', hidden: false, children: [], style: {}, dataset: {},
      append(...items: Node[]) { node.children.push(...items); }, replaceChildren() { node.children = []; },
      setAttribute() {}, remove() {}, addEventListener(type: string, fn: () => unknown) { if (type === 'click') node.click = fn; },
    };
    nodes.push(node);
    return node;
  };
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
  const fetchStub = vi.fn(async (input: unknown, init?: { method?: string }) => {
    const url = typeof input === 'string' ? input : (input as { url: string }).url;
    fetched.push({ url, method: init?.method ?? (input as { method?: string }).method ?? 'GET' });
    if (url.includes('/api/auth/session')) {
      if (session === 'network-error') throw new TypeError('Failed to fetch');
      return json({ authenticated: session });
    }
    if (url.endsWith('/_t3/pwa/create')) return create === 'ok' ? json({ id: 'a'.repeat(32), code: 'AB12CD34', expires: Math.floor(Date.now() / 1000) + 300 }, 201) : json({ reason: 'handoff_disabled', remedy: '引き継ぎが無効です。設定ファイルを確かめてください。' }, 503);
    if (url.endsWith('/_t3/pwa/diagnose')) return json({ checks: [{ name: '引き継ぎの設定', ok: false, reason: 'handoff_disabled', remedy: '引き継ぎが無効です。設定ファイルを確かめてください。', detail: 'ENOENT' }, { name: 'T3本体', ok: true }] });
    if (url.endsWith('/_t3/pwa/status')) return json({ state: status, code: 'AB12CD34' });
    if (url.endsWith('/_t3/pwa/claim')) return claim === 'ok' ? json({ credential: 'ABCD2345EFGH' }) : json({ reason: 'expired', remedy: '申請の期限(5分)が切れました。再読み込みしてください。' }, 409);
    return json({ error: 'unexpected' }, 500);
  });
  const win: Record<string, unknown> = { fetch: fetchStub, matchMedia: () => ({ matches: standalone }), addEventListener() {}, removeEventListener() {}, WebSocket: class {} };
  win.top = win;
  const store = () => { const data = new Map<string, string>(); return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } }; };
  // 本物のRequestと同じく、相対URLの解決と、メソッド・本文の引き継ぎをする。
  vi.stubGlobal('Request', class { url: string; headers: Headers; method: string; body: unknown; constructor(input: unknown, init?: { headers?: HeadersInit; method?: string; body?: unknown }) { const from = typeof input === 'string' ? null : (input as { url: string; method?: string; body?: unknown }); this.url = new URL(from ? from.url : (input as string), 'https://t3.example.test/').href; this.headers = new Headers(init?.headers); this.method = init?.method ?? from?.method ?? 'GET'; this.body = init?.body ?? from?.body; } });
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', { getElementById: () => null, createElement: element, head: { append() {} }, body: { append() {} }, addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' });
  vi.stubGlobal('navigator', { standalone });
  vi.stubGlobal('location', { pathname: '/', href: 'https://t3.example.test/', origin: 'https://t3.example.test', protocol: 'https:', host: 't3.example.test', reload() {} });
  vi.stubGlobal('history', { replaceState: (_s: unknown, _t: string, url: string) => { history.push(url); } });
  vi.stubGlobal('localStorage', store());
  vi.stubGlobal('sessionStorage', store());
  const text = () => nodes.map(node => node.textContent).join('\n');
  const button = (label: string) => nodes.find(node => node.tag === 'button' && node.textContent === label);
  const link = () => nodes.find(node => node.tag === 'a' && node.href?.includes('/_t3/pwa/approve/'));
  const posted = (path: string) => fetched.some(f => f.url.endsWith(path) && f.method === 'POST');
  return { fetched, history, text, button, link, posted };
}

beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); vi.resetModules(); (globalThis as { __t3NativeLoaded?: number }).__t3NativeLoaded = 0; });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('セッションが無いPWA: 引き継ぎ', () => {
  it('承認されたら資格情報を受け取り、/#token=<資格情報> にしてからT3の画面を起動する', async () => {
    const b = installBrowser({ session: false });
    const { start } = await import(CLIENT);
    await start(entry());
    expect(b.posted('/_t3/pwa/create')).toBe(true);
    expect(b.posted('/_t3/pwa/claim')).toBe(true);
    expect(b.history).toEqual(['/#token=ABCD2345EFGH']);
    expect(loaded()).toBe(1);
  });
  it('承認を待つ間は、確認コードと、ブラウザで承認するリンクと、「トークンで入る」ボタンを出す', async () => {
    const b = installBrowser({ session: false, status: 'pending' });
    const { start } = await import(CLIENT);
    await start(entry());
    expect(loaded()).toBe(0);
    expect(b.text()).toContain('AB12CD34');
    expect(b.link()?.href).toBe('/_t3/pwa/approve/' + 'a'.repeat(32));
    expect(b.button('トークンで入る')).toBeDefined();
  });
  it('「トークンで入る」を押すと、T3の標準のペアリング画面へ進む', async () => {
    const b = installBrowser({ session: false, status: 'pending' });
    const { start } = await import(CLIENT);
    await start(entry());
    await b.button('トークンで入る')!.click!();
    expect(loaded()).toBe(1);
    expect(b.history).toEqual([]);
  });
  it('申請を作れないとき(引き継ぎが無効など)は、黙って進まず、サーバーが返した対処を出し、「トークンで入る」を出す。確認のボタンは出さない', async () => {
    const b = installBrowser({ session: false, create: 'fail' });
    const { start } = await import(CLIENT);
    await start(entry());
    expect(loaded()).toBe(0);
    expect(b.text()).toContain('引き継ぎが無効です。設定ファイルを確かめてください。');
    expect(b.button('トークンで入る')).toBeDefined();
    expect(b.button('状態を確認する')).toBeUndefined();
    expect(b.posted('/_t3/pwa/claim')).toBe(false);
  });
  it('失敗したら、ボタンを押させずに自動で診断し、各項目をOKか、だめなら理由と対処で表示する', async () => {
    const b = installBrowser({ session: false, create: 'fail' });
    const { start } = await import(CLIENT);
    await start(entry());
    expect(b.text()).toContain('✕ 引き継ぎの設定: ENOENT');
    expect(b.text()).toContain('対処: 引き継ぎが無効です。設定ファイルを確かめてください。');
    expect(b.text()).toContain('✓ T3本体');
  });
  it('受け取りに失敗したときは、サーバーが返した対処を出し、「トークンで入る」で先へ進める(資格情報は入れない)', async () => {
    const b = installBrowser({ session: false, claim: 'fail' });
    const { start } = await import(CLIENT);
    await start(entry());
    expect(loaded()).toBe(0);
    expect(b.history).toEqual([]);
    expect(b.text()).toContain('申請の期限(5分)が切れました。再読み込みしてください。');
    expect(b.button('トークンで入る')).toBeDefined();
  });
});

describe('引き継ぎの申請を作らない場合', () => {
  it('セッションがあるPWAは、そのままT3の画面を起動する', async () => {
    const b = installBrowser({ session: true });
    const { start } = await import(CLIENT);
    await start(entry());
    expect(loaded()).toBe(1);
    expect(b.posted('/_t3/pwa/create')).toBe(false);
  });
  it('通常のブラウザー(PWAでない)では、何もせずT3を開く', async () => {
    const b = installBrowser({ session: false, standalone: false });
    const { start } = await import(CLIENT);
    await start(entry());
    expect(loaded()).toBe(1);
    expect(b.fetched).toHaveLength(0);
  });
  it('ログイン状態を確認できない(通信失敗)ときは、T3の標準画面へ進む', async () => {
    const b = installBrowser({ session: 'network-error' });
    const { start } = await import(CLIENT);
    await start(entry());
    expect(loaded()).toBe(1);
    expect(b.posted('/_t3/pwa/create')).toBe(false);
  });
});
