// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { getMuseStatusPage, MUSE_STATUS_SCRIPT, MUSE_STATUS_SIGNAL_DEFAULT_SECONDS } from './museStatus';

type Script = {
  initMuseStatusPage(deps: unknown): Promise<unknown>;
  createMuseSignalSchedule(options: unknown): { apply(): void; stop(): void; checkIfDue(): void };
  readMuseStatusSettings(cookie: string): { enabled: boolean; intervalSeconds: number };
  museNodesFromNetMap(value: unknown): { name: string; found: boolean; online: boolean | null; ip: string }[];
  museWasmHealthURL(node: { found: boolean; ip: string }): string | null;
  sendMuseWasmSignal(client: { fetch(url: string): Promise<unknown> }, node: string, url: string | null, timeoutMs?: number): Promise<{ code: string; detail: string | null }>;
};
const script = new Function(`${MUSE_STATUS_SCRIPT}\nreturn { initMuseStatusPage, createMuseSignalSchedule, readMuseStatusSettings, museNodesFromNetMap, museWasmHealthURL, sendMuseWasmSignal };`)() as Script;
const NODES = ['muse', 'muse-vm'];
const COOKIE = 'muse_status_signal';

function clearCookie() {
  document.cookie = `${COOKIE}=; path=/; max-age=0`;
}

function loadBody() {
  const html = getMuseStatusPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>', html.indexOf('<body>')));
}

function api(overrides: Record<string, unknown> = {}) {
  return vi.fn(async (url: string, init?: { body?: string }) => {
    if (url in overrides) return overrides[url];
    if (url === '/api/muse-status') {
      return {
        containerRunning: true, error: null, checkedAt: '2026-11-06T00:00:00Z',
        nodes: [
          { name: 'muse', found: true, online: true, connection: 'relay', relay: 'nyc', os: '', ip: '100.0.0.1', lastSeen: '', lastHandshake: '' },
          { name: 'muse-vm', found: true, online: false, connection: 'none', relay: '', os: 'linux', ip: '100.0.0.2', lastSeen: '2026-11-06T00:00:00Z', lastHandshake: '' },
        ],
      };
    }
    if (url === '/api/muse-status/signal') {
      return { node: JSON.parse(init?.body ?? '{}').node, code: 'ok', latencyMs: 12, checkedAt: '2026-11-06T00:00:00Z' };
    }
    const node = new URL(url, 'http://x').searchParams.get('node');
    return { node, state: 'not_provided', packages: [], total: 0, truncated: false, generatedAt: null };
  });
}
const signalCalls = (fetchJson: ReturnType<typeof api>) => fetchJson.mock.calls.filter(([url]) => url === '/api/muse-status/signal').length;
const card = (node: string) => document.querySelector(`[data-node="${node}"]`) as HTMLElement;
const field = (node: string, name: string) => card(node).querySelector(`[data-field="${name}"]`) as HTMLElement;
const input = (id: string) => document.getElementById(id) as HTMLInputElement;

describe('/muse-statusのページ', () => {
  beforeEach(() => { clearCookie(); loadBody(); });
  afterEach(() => { clearCookie(); vi.useRealTimers(); });

  it('muse・muse-vmの両方の状態を表示する', async () => {
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson: api() });
    expect(field('muse', 'online').textContent).toBe('オンライン');
    expect(field('muse', 'connection').textContent).toBe('中継 nyc');
    expect(field('muse-vm', 'online').textContent).toBe('オフライン');
    expect(field('muse-vm', 'os').textContent).toBe('linux');
    expect(document.getElementById('muse-container')?.textContent).toBe('起動中');
  });

  it('Cookieが無ければ既定値を画面へ反映し、読み込み時にシグナルを送る', async () => {
    const fetchJson = api();
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson });
    expect(input('muse-signal-enabled').checked).toBe(true);
    expect(input('muse-signal-interval').value).toBe(String(MUSE_STATUS_SIGNAL_DEFAULT_SECONDS));
    expect(signalCalls(fetchJson)).toBe(1);
    expect(field('muse-vm', 'signal').textContent).toBe('稼働中');
  });

  it('外向き専用museは表示を保ち、初期・手動・定期処理でHTTP検査しない', async () => {
    vi.useFakeTimers();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const fetchJson = api();
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson });
    expect(field('muse', 'online').textContent).toBe('オンライン');
    expect(card('muse').textContent).toContain('外向き専用');
    expect(field('muse', 'signal').textContent).toContain('対象外');
    expect(field('muse', 'nixSummary').textContent).toContain('外向き専用');
    const signal = card('muse').querySelector('[data-action="signal"]') as HTMLButtonElement;
    const nix = card('muse').querySelector('[data-action="nixReload"]') as HTMLButtonElement;
    expect(signal.disabled).toBe(true);
    expect(nix.disabled).toBe(true);
    signal.click(); nix.click();
    await vi.advanceTimersByTimeAsync(MUSE_STATUS_SIGNAL_DEFAULT_SECONDS * 1000);
    const sent = fetchJson.mock.calls.filter(([url]) => url === '/api/muse-status/signal');
    expect(sent).toHaveLength(2);
    expect(sent.every(([, init]) => JSON.parse(init?.body ?? '{}').node === 'muse-vm')).toBe(true);
    expect(fetchJson.mock.calls.filter(([url]) => url === '/api/muse-status/nix?node=muse')).toHaveLength(0);
    vi.restoreAllMocks();
  });

  it('Cookieの値をページ読み込み時に画面へ反映する', async () => {
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify({ enabled: false, intervalSeconds: 120 }))}; path=/`;
    const fetchJson = api();
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson });
    expect(input('muse-signal-enabled').checked).toBe(false);
    expect(input('muse-signal-interval').value).toBe('120');
    expect(input('muse-signal-interval').disabled).toBe(true);
    expect(signalCalls(fetchJson)).toBe(0);
  });

  it('変更した値をCookieへ保存し、次の読み込みで復元する', async () => {
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson: api() });
    input('muse-signal-interval').value = '300';
    input('muse-signal-interval').dispatchEvent(new Event('change'));
    expect(script.readMuseStatusSettings(document.cookie)).toEqual({ enabled: true, intervalSeconds: 300 });
    loadBody();
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson: api() });
    expect(input('muse-signal-interval').value).toBe('300');
  });

  it('範囲外の間隔は保存しない', async () => {
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson: api() });
    input('muse-signal-interval').value = '10';
    input('muse-signal-interval').dispatchEvent(new Event('change'));
    expect(document.getElementById('muse-signal-error')?.textContent).toContain('60');
    expect(document.cookie).not.toContain(COOKIE);
  });

  it('壊れたCookieは既定値として扱う', () => {
    expect(script.readMuseStatusSettings(`${COOKIE}=%E0%A4%A`)).toEqual({ enabled: true, intervalSeconds: MUSE_STATUS_SIGNAL_DEFAULT_SECONDS });
    expect(script.readMuseStatusSettings(`${COOKIE}=${encodeURIComponent('{"intervalSeconds":1}')}`).intervalSeconds).toBe(MUSE_STATUS_SIGNAL_DEFAULT_SECONDS);
  });

  it('ボタンで指定のノードへだけシグナルを送る', async () => {
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify({ enabled: false, intervalSeconds: 120 }))}; path=/`;
    const fetchJson = api();
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson });
    (card('muse-vm').querySelector('[data-action="signal"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(field('muse-vm', 'signal').textContent).toBe('稼働中'));
    const sent = fetchJson.mock.calls.filter(([url]) => url === '/api/muse-status/signal');
    expect(sent.map(([, init]) => JSON.parse(init?.body ?? '{}').node)).toEqual(['muse-vm']);
    expect(field('muse', 'signal').textContent).toContain('対象外');
  });

  // 2026-11-07: Tailscaleではオンラインなのに「接続できません」になり、理由が分からなかった。
  it('接続できないときは理由(ncのエラー出力)を文字として表示し、オンラインならTailscale以外の原因だと案内する', async () => {
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify({ enabled: false, intervalSeconds: 120 }))}; path=/`;
    const fetchJson = api({ '/api/muse-status': { containerRunning: true, error: null, nodes: [{ name: 'muse-vm', found: true, online: true }] }, '/api/muse-status/signal': { node: 'muse-vm', code: 'connection_failed', latencyMs: null, checkedAt: '2026-11-06T00:00:00Z', detail: '<img src=x>connection refused' } });
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson });
    (card('muse-vm').querySelector('[data-action="signal"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(field('muse-vm', 'signal').textContent).toBe('接続できません'));
    const detail = field('muse-vm', 'signalDetail');
    expect(detail.textContent).toContain('<img src=x>connection refused');
    expect(detail.querySelector('img')).toBeNull();
    expect(detail.textContent).toContain('Tailscaleではオンライン');
    expect(detail.textContent).toContain('8080');
    expect(detail.hidden).toBe(false);
  });

  it('稼働中に戻れば理由の表示を消す', async () => {
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify({ enabled: false, intervalSeconds: 120 }))}; path=/`;
    let code = 'connection_failed';
    const fetchJson = api();
    const base = fetchJson.getMockImplementation()!;
    fetchJson.mockImplementation(async (url: string, init?: { body?: string }) => (url === '/api/muse-status/signal'
      ? { node: 'muse-vm', code, latencyMs: null, checkedAt: '2026-11-06T00:00:00Z', detail: code === 'ok' ? null : 'refused' }
      : base(url, init)));
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson });
    const button = card('muse-vm').querySelector('[data-action="signal"]') as HTMLButtonElement;
    button.click();
    await vi.waitFor(() => expect(field('muse-vm', 'signalDetail').hidden).toBe(false));
    // muse-vmはTailscaleでオフラインなので、オンラインの案内は出さない
    expect(field('muse-vm', 'signalDetail').textContent).not.toContain('Tailscaleではオンライン');
    code = 'ok';
    await vi.waitFor(() => expect(button.disabled).toBe(false));
    button.click();
    await vi.waitFor(() => expect(field('muse-vm', 'signal').textContent).toBe('稼働中'));
    expect(field('muse-vm', 'signalDetail').hidden).toBe(true);
    expect(field('muse-vm', 'signalDetail').textContent).toBe('');
  });

  it('Nixの一覧を表示して絞り込む。上流の文字列はHTMLとして解釈しない', async () => {
    const fetchJson = api({ '/api/muse-status/nix?node=muse-vm': {
      node: 'muse-vm', state: 'ok', total: 2, truncated: false, generatedAt: null,
      packages: [{ name: '<img src=x onerror=alert(1)>', version: null }, { name: 'hello', version: '2.12' }],
    } });
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson });
    const rows = field('muse-vm', 'nixRows');
    expect(rows.querySelectorAll('tr')).toHaveLength(2);
    expect(rows.querySelector('img')).toBeNull();
    expect(field('muse-vm', 'nixTable').hidden).toBe(false);
    const filter = card('muse-vm').querySelector('[data-action="nixFilter"]') as HTMLInputElement;
    filter.value = 'HEL';
    filter.dispatchEvent(new Event('input'));
    expect(rows.querySelectorAll('tr')).toHaveLength(1);
    expect(field('muse-vm', 'nixSummary').textContent).toContain('一致 1件');
  });

  it('ノードがNixの一覧を提供していないときはその旨を表示する', async () => {
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson: api() });
    expect(field('muse-vm', 'nixSummary').textContent).toContain('/nix/packages を提供していません');
    expect(field('muse-vm', 'nixTable').hidden).toBe(true);
  });

  it('本体コンテナの停止を案内する', async () => {
    const fetchJson = api({ '/api/muse-status': {
      containerRunning: false, error: 'container_not_running', checkedAt: '', nodes: NODES.map((name) => ({ name, found: false })),
    } });
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson });
    expect(document.getElementById('muse-notice')?.textContent).toContain('/cf-containers');
    // 停止中は本体コンテナから何も読めていない。「見つからない」とは言わない
    expect(field('muse', 'online').textContent).toBe('確認できません');
  });
});

// 2026-11-07: 本体コンテナが停止中でも、ブラウザのTailscale WASM(@tailscale/connect)で状態とシグナルを取得する。
describe('/muse-statusのTailscale WASM経由の取得', () => {
  const STOPPED = { containerRunning: false, error: 'container_not_running', checkedAt: '', nodes: NODES.map((name) => ({ name, found: false })) };
  const NOT_RUNNING_SIGNAL = { node: 'muse-vm', code: 'container_not_running', latencyMs: null, checkedAt: '2026-11-07T00:00:00Z', detail: null };
  const NOT_RUNNING_NIX = { node: 'muse-vm', state: 'container_not_running', packages: [], total: 0, truncated: false, generatedAt: null };
  const NETMAP = {
    self: { name: 'muse-status-browser.example.ts.net.', addresses: ['100.64.9.9'] },
    peers: [
      { name: 'muse-vm.example.ts.net.', addresses: ['fd7a:115c:a1e0::1', '100.101.102.103'], online: true, machineKey: 'mkey:secret' },
      { name: 'muse.example.ts.net.', addresses: ['100.70.0.1'] },
      { name: 'muse-vm-old.example.ts.net.', addresses: ['100.70.0.2'], online: true },
    ],
  };
  type Callbacks = { notifyState(state: string): void; notifyNetMap(value: unknown): void; notifyBrowseToURL(url: string): void };
  type FakeResponse = { status: number; statusText: string; text(): Promise<string> };

  function fakeTailscale() {
    const state = {
      callbacks: null as Callbacks | null,
      configs: [] as Record<string, unknown>[],
      fetched: [] as string[],
      logins: 0,
      logouts: 0,
      respond: async (_url: string): Promise<FakeResponse> => ({ status: 200, statusText: '200 OK', text: async () => '{"status":"ok"}' }),
    };
    const create = vi.fn(async (config: Record<string, unknown>) => {
      state.configs.push(config);
      return {
        run: (callbacks: Callbacks) => { state.callbacks = callbacks; },
        login: () => { state.logins++; },
        logout: () => { state.logouts++; },
        fetch: (url: string) => { state.fetched.push(url); return state.respond(url); },
      };
    });
    return { state, create };
  }
  function stoppedApi() {
    return api({ '/api/muse-status': STOPPED, '/api/muse-status/signal': NOT_RUNNING_SIGNAL, '/api/muse-status/nix?node=muse-vm': NOT_RUNNING_NIX });
  }
  const button = (id: string) => document.getElementById(id) as HTMLButtonElement;
  async function connectWasm(tailscale: ReturnType<typeof fakeTailscale>) {
    button('muse-wasm-connect').click();
    await vi.waitFor(() => expect(tailscale.state.callbacks).not.toBeNull());
    tailscale.state.callbacks!.notifyState('Running');
    tailscale.state.callbacks!.notifyNetMap(JSON.stringify(NETMAP));
  }

  beforeEach(() => {
    clearCookie();
    sessionStorage.clear();
    loadBody();
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify({ enabled: false, intervalSeconds: 120 }))}; path=/`;
  });
  afterEach(() => { clearCookie(); sessionStorage.clear(); vi.useRealTimers(); });

  it('netmapからmuse・muse-vmだけを名前の先頭ラベルで取り出し、鍵は持ち出さない', () => {
    const nodes = script.museNodesFromNetMap(JSON.stringify(NETMAP));
    expect(nodes.map((node) => node.name)).toEqual(['muse', 'muse-vm']);
    expect(nodes[1]).toMatchObject({ found: true, online: true, ip: '100.101.102.103' });
    // onlineが省略されたピアは「不明」で、オフラインと決めつけない
    expect(nodes[0]).toMatchObject({ found: true, online: null, ip: '100.70.0.1' });
    expect(JSON.stringify(nodes)).not.toContain('mkey');
    expect(script.museNodesFromNetMap({ peers: [] }).every((node) => !node.found)).toBe(true);
    expect(() => script.museNodesFromNetMap('{}')).toThrow();
  });

  it('/healthのURLはtailnetのIPv4(100.64.0.0/10)からだけ作る', () => {
    expect(script.museWasmHealthURL({ found: true, ip: '100.101.102.103' })).toBe('http://100.101.102.103:8080/health');
    expect(script.museWasmHealthURL({ found: true, ip: '192.168.0.1' })).toBeNull();
    expect(script.museWasmHealthURL({ found: true, ip: '100.128.0.1' })).toBeNull();
    expect(script.museWasmHealthURL({ found: false, ip: '' })).toBeNull();
  });

  it('停止中で未接続なら、/cf-containersからの起動とTailscaleへの接続を案内し、WASMは自動で読み込まない', async () => {
    const tailscale = fakeTailscale();
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson: stoppedApi(), createTailscaleClient: tailscale.create });
    const notice = document.getElementById('muse-notice')!.textContent ?? '';
    expect(notice).toContain('/cf-containers');
    expect(notice).toContain('Tailscaleへ接続');
    expect(document.getElementById('muse-source')?.textContent).toBe('なし');
    expect(tailscale.create).not.toHaveBeenCalled();
  });

  it('接続後は停止中でもnetmapで状態を表示し、muse-vmの/healthへWASMでシグナルを送る。museへは送らない', async () => {
    const tailscale = fakeTailscale();
    const fetchJson = stoppedApi();
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson, createTailscaleClient: tailscale.create });
    await connectWasm(tailscale);
    expect(tailscale.state.configs[0]).toMatchObject({ authKey: '', hostname: 'muse-status-browser' });
    expect(tailscale.state.logins).toBe(1);
    await vi.waitFor(() => expect(field('muse-vm', 'online').textContent).toBe('オンライン'));
    expect(field('muse-vm', 'ip').textContent).toBe('100.101.102.103');
    expect(field('muse', 'online').textContent).toBe('不明');
    expect(document.getElementById('muse-source')?.textContent).toContain('Tailscale WASM');
    expect(document.getElementById('muse-notice')?.hidden).toBe(true);

    (card('muse-vm').querySelector('[data-action="signal"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(field('muse-vm', 'signal').textContent).toBe('稼働中'));
    // Museの提案(msw-p1): WASMの成功は到達性だけを示す
    expect(field('muse-vm', 'signalAt').textContent).toContain('WASM');
    expect(field('muse-vm', 'signalAt').textContent).toContain('到達性');
    expect(tailscale.state.fetched).toEqual(['http://100.101.102.103:8080/health']);
    expect(tailscale.state.fetched.some((url) => url.includes('100.70.0.1'))).toBe(false);
  });

  it('WASM経由ではNixの一覧を取らず、キーをブラウザへ渡さないためだと表示する', async () => {
    const tailscale = fakeTailscale();
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson: stoppedApi(), createTailscaleClient: tailscale.create });
    await connectWasm(tailscale);
    (card('muse-vm').querySelector('[data-action="nixReload"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(field('muse-vm', 'nixSummary').textContent).toContain('MUSE_API_KEY'));
    expect(field('muse-vm', 'nixSummary').textContent).toContain('WASM');
    expect(tailscale.state.fetched.some((url) => url.includes('/nix'))).toBe(false);
    expect(JSON.stringify(tailscale.state.configs)).not.toMatch(/Bearer|MUSE_API_KEY/);
  });

  it('WASMのシグナルの失敗を区別する: 異常応答、接続できません(理由は文字で)、時間切れ', async () => {
    const tailscale = fakeTailscale();
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson: stoppedApi(), createTailscaleClient: tailscale.create });
    await connectWasm(tailscale);
    const signal = card('muse-vm').querySelector('[data-action="signal"]') as HTMLButtonElement;

    tailscale.state.respond = async () => ({ status: 503, statusText: '503', text: async () => 'busy' });
    signal.click();
    await vi.waitFor(() => expect(field('muse-vm', 'signal').textContent).toBe('異常応答'));

    tailscale.state.respond = async () => { throw new Error('<b>dial tcp: connection refused</b>'); };
    await vi.waitFor(() => expect(signal.disabled).toBe(false));
    signal.click();
    await vi.waitFor(() => expect(field('muse-vm', 'signal').textContent).toBe('接続できません'));
    expect(field('muse-vm', 'signalDetail').textContent).toContain('<b>dial tcp: connection refused</b>');
    expect(field('muse-vm', 'signalDetail').querySelector('b')).toBeNull();
    expect(field('muse-vm', 'signalDetail').textContent).toContain('ACL');

    const result = await script.sendMuseWasmSignal({ fetch: () => new Promise(() => {}) }, 'muse-vm', 'http://100.101.102.103:8080/health', 10);
    expect(result.code).toBe('timeout');
  });

  it('本体コンテナが起動中ならWASMに接続していても本体コンテナ経由を使う', async () => {
    const tailscale = fakeTailscale();
    const fetchJson = api();
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson, createTailscaleClient: tailscale.create });
    await connectWasm(tailscale);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(field('muse-vm', 'os').textContent).toBe('linux');
    expect(document.getElementById('muse-source')?.textContent).toBe('本体コンテナ');
    (card('muse-vm').querySelector('[data-action="signal"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(field('muse-vm', 'signal').textContent).toBe('稼働中'));
    expect(tailscale.state.fetched).toEqual([]);
  });

  it('切断・ログアウトで古いWASMの表示を捨て、保存した参加状態を消す', async () => {
    const tailscale = fakeTailscale();
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson: stoppedApi(), createTailscaleClient: tailscale.create });
    await connectWasm(tailscale);
    await vi.waitFor(() => expect(field('muse-vm', 'online').textContent).toBe('オンライン'));
    (tailscale.state.configs[0].stateStorage as { setState(k: string, v: string): void }).setState('profiles', 'x');
    expect(sessionStorage.getItem('muse-status.tailscale.profiles')).toBe('x');

    tailscale.state.callbacks!.notifyState('NeedsLogin');
    await vi.waitFor(() => expect(field('muse-vm', 'online').textContent).toBe('確認できません'));
    expect(document.getElementById('muse-source')?.textContent).toBe('なし');

    button('muse-wasm-logout').click();
    expect(tailscale.state.logouts).toBe(1);
    expect(sessionStorage.getItem('muse-status.tailscale.profiles')).toBeNull();
  });

  it('TailscaleのHTTPSのログインURLだけをリンクにする', async () => {
    const tailscale = fakeTailscale();
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson: stoppedApi(), createTailscaleClient: tailscale.create });
    button('muse-wasm-connect').click();
    await vi.waitFor(() => expect(tailscale.state.callbacks).not.toBeNull());
    const login = document.getElementById('muse-wasm-login')!;
    tailscale.state.callbacks!.notifyBrowseToURL('https://evil.example/a/x');
    tailscale.state.callbacks!.notifyBrowseToURL('http://login.tailscale.com/a/x');
    expect(login.children).toHaveLength(0);
    tailscale.state.callbacks!.notifyBrowseToURL('https://login.tailscale.com/a/x');
    const link = login.querySelector('a')!;
    expect(link.href).toBe('https://login.tailscale.com/a/x');
    expect(link.rel).toBe('noopener noreferrer');
  });

  it('このタブで参加済みなら、停止中のときだけ読み込み時に自動で再接続する', async () => {
    sessionStorage.setItem('muse-status.tailscale.profiles', 'saved');
    const running = fakeTailscale();
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson: api(), createTailscaleClient: running.create });
    expect(running.create).not.toHaveBeenCalled();
    loadBody();
    const stopped = fakeTailscale();
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson: stoppedApi(), createTailscaleClient: stopped.create });
    await vi.waitFor(() => expect(stopped.create).toHaveBeenCalledTimes(1));
  });

  it('WASMの読み込みに失敗したら理由を表示し、もう一度押せる', async () => {
    const create = vi.fn(async () => { throw new Error('WASM取得 HTTP 404'); });
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson: stoppedApi(), createTailscaleClient: create });
    button('muse-wasm-connect').click();
    await vi.waitFor(() => expect(document.getElementById('muse-wasm-state')?.textContent).toContain('HTTP 404'));
    expect(button('muse-wasm-connect').disabled).toBe(false);
  });
});

describe('getMuseStatusPage', () => {
  it('生成HTMLの全scriptがnode --checkに通る', () => {
    const page = new DOMParser().parseFromString(getMuseStatusPage(), 'text/html');
    const scripts = [...page.querySelectorAll('script')];
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
      expect(() => execFileSync(process.execPath, ['--check'], { input: script.textContent ?? '' })).not.toThrow();
    }
  });
  it('WASMの読み込みは同一オリジンの共通ローダーから必要時に行う', () => {
    const html = getMuseStatusPage();
    expect(html).toContain("import('/tailscale-wasm-client.mjs')");
    expect(html).toContain('id="muse-wasm-connect"');
    expect(html).not.toMatch(/https?:\/\/[^"'\s]*tailscale-connect/);
  });
  it('scriptを本文の文字として出さない', () => {
    const page = new DOMParser().parseFromString(getMuseStatusPage(), 'text/html');
    page.querySelectorAll('script, style').forEach((element) => element.remove());
    expect(page.body.textContent).not.toContain('function ');
    expect(page.querySelector('.muse-nav .theme-toggle')).not.toBeNull();
  });
});

describe('シグナルの定期送信', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    const state = { hidden: false, settings: { enabled: true, intervalSeconds: 60 } };
    const send = vi.fn();
    const schedule = script.createMuseSignalSchedule({ send, isHidden: () => state.hidden, getSettings: () => state.settings });
    return { state, send, schedule };
  }

  it('間隔ごとに送り、タブが隠れている間は送らない', () => {
    const { state, send, schedule } = setup();
    schedule.apply();
    vi.advanceTimersByTime(60_000);
    expect(send).toHaveBeenCalledTimes(1);
    state.hidden = true;
    vi.advanceTimersByTime(120_000);
    expect(send).toHaveBeenCalledTimes(1);
    state.hidden = false;
    schedule.checkIfDue();
    expect(send).toHaveBeenCalledTimes(2);
    schedule.stop();
  });

  it('OFFなら送らない', () => {
    const { state, send, schedule } = setup();
    state.settings.enabled = false;
    schedule.apply();
    vi.advanceTimersByTime(600_000);
    schedule.checkIfDue();
    expect(send).not.toHaveBeenCalled();
  });
});
