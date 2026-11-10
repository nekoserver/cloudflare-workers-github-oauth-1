// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { getMuseWasmTestPage, MUSE_WASM_TEST_CSP, MUSE_WASM_TEST_SCRIPT } from './museWasmTest';
import { MUSE_STATUS_CSP } from './museStatus';

// 対象: /muse-wasm-testのページ。公式Tailscale WASMでtailnetに入り、muse-vmの/healthへ定期的にGETを送って
// 記録する。要望はWorkerのAPI経由でbridge_jobsへ積む(WASMのfetchはGETだけでヘッダーを付けられないため)。
// 故障想定: tailscale.com以外のログインURLを出す / 上流の本文をHTMLとして解釈する / 失敗が記録に残らない /
// 切断後も送り続ける / 空の要望を送る / 積んだジョブが一覧に出ない。

type Client = { run(cb: Record<string, (v: string) => void>): void; login(): void; logout(): void; fetch(url: string): Promise<{ status: number; statusText: string; text(): Promise<string> }> };
type Script = { initMuseWasmTest(deps: unknown): Promise<unknown> };
const script = new Function(`${MUSE_WASM_TEST_SCRIPT}\nreturn { initMuseWasmTest };`)() as Script;

const NETMAP = JSON.stringify({ peers: [
  { name: 'muse-vm.taile4e096.ts.net.', addresses: ['100.86.29.77', 'fd7a::1'], online: true },
  { name: 'muse.taile4e096.ts.net.', addresses: ['100.73.113.53'] },
] });

function loadBody() {
  const html = getMuseWasmTestPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');
}

function setup(options: { fetchImpl?: (url: string) => Promise<unknown>; api?: (url: string, init?: { method?: string; body?: string }) => Promise<unknown> } = {}) {
  let callbacks: Record<string, (v: string) => void> = {};
  const client: Client = {
    run: (cb) => { callbacks = cb; },
    login: vi.fn(),
    logout: vi.fn(),
    fetch: vi.fn(options.fetchImpl ?? (async () => ({ status: 200, statusText: '200 OK', text: async () => '{"status": "ok"}' }))) as Client['fetch'],
  };
  const intervals: { fn: () => void; ms: number; cleared: boolean }[] = [];
  const fetchJson = vi.fn(options.api ?? (async (url: string) => (url === '/api/tailscale-wasm/jobs' ? { jobs: [] } : {})));
  const deps = {
    document,
    createTailscaleClient: vi.fn(async () => client),
    fetchJson,
    setInterval: (fn: () => void, ms: number) => { intervals.push({ fn, ms, cleared: false }); return intervals.length - 1; },
    clearInterval: (id: number) => { if (intervals[id]) intervals[id].cleared = true; },
    now: () => Date.parse('2026-11-08T12:00:00Z'),
  };
  return { client, deps, intervals, fetchJson, callbacks: () => callbacks };
}
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('/muse-wasm-testの到達確認(Workerのノード、ブラウザのログイン無し)', () => {
  beforeEach(loadBody);
  const STATUS = { state: 'Running', peers: [
    { name: 'muse-vm.taile4e096.ts.net.', addresses: ['100.86.29.77', 'fd7a::1'], online: true },
    { name: 'muse.taile4e096.ts.net.', addresses: ['100.73.113.53'], online: true },
  ] };
  const api = (health: unknown, status: unknown) => async (url: string) =>
    url === '/api/tailscale-wasm/bridge-health' ? health : url === '/api/tailscale-wasm/status' ? status : url === '/api/tailscale-wasm/jobs' ? { jobs: [] } : {};

  it('開くとWorkerのノードでmuse-vmの/healthを確かめ、ブラウザ側のTailscaleは使わない', async () => {
    const { deps, fetchJson, intervals } = setup({ api: api({ healthy: true, transport: 'worker' }, STATUS) });
    await script.initMuseWasmTest(deps);
    await flush(); await flush();
    const urls = fetchJson.mock.calls.map(([url]) => url);
    expect(urls).toContain('/api/tailscale-wasm/bridge-health');
    expect(urls).toContain('/api/tailscale-wasm/status');
    expect(deps.createTailscaleClient).not.toHaveBeenCalled();
    const rows = $('mwt-log').querySelectorAll('tr');
    expect(rows).toHaveLength(1);
    expect(rows[0].classList.contains('mwt-ng')).toBe(false);
    expect(rows[0].textContent).toContain('Running');
    expect(rows[0].textContent).toContain('100.86.29.77');
    expect(intervals.filter((i) => !i.cleared).map((i) => i.ms)).toEqual([30_000]);
    intervals[0].fn();
    await flush(); await flush();
    expect($('mwt-log').querySelectorAll('tr')).toHaveLength(2);
  });

  it('届かないときは、ノードの状態とmuse-vmのオンライン表示を理由として残す', async () => {
    const { deps } = setup({ api: api({ healthy: false, transport: 'worker' }, { state: 'Running', peers: [{ name: 'muse-vm.x.', addresses: ['100.86.29.77'], online: false }] }) });
    await script.initMuseWasmTest(deps);
    await flush(); await flush();
    const row = $('mwt-log').querySelector('tr')!;
    expect(row.classList.contains('mwt-ng')).toBe(true);
    expect(row.textContent).toContain('オフライン');
  });

  it('Workerのノードが承認待ちなら、tailscale.comの承認URLだけをリンクにする(一度承認すればWorkerに保存される)', async () => {
    const { deps } = setup({ api: api({ healthy: false }, { state: 'NeedsLogin', peers: [], loginURL: 'https://login.tailscale.com/a/abc' }) });
    await script.initMuseWasmTest(deps);
    await flush(); await flush();
    expect($('mwt-login').querySelector('a')?.getAttribute('href')).toBe('https://login.tailscale.com/a/abc');
    const evil = setup({ api: api({ healthy: false }, { state: 'NeedsLogin', peers: [], loginURL: 'https://evil.example/a/1' }) });
    loadBody();
    await script.initMuseWasmTest(evil.deps);
    await flush(); await flush();
    expect($('mwt-login').querySelector('a')).toBeNull();
  });

  it('APIの失敗も表に残す', async () => {
    const { deps } = setup({ api: async (url: string) => { if (url === '/api/tailscale-wasm/jobs') return { jobs: [] }; throw new Error('Failed to fetch'); } });
    await script.initMuseWasmTest(deps);
    await flush(); await flush();
    expect($('mwt-log').textContent).toContain('Failed to fetch');
  });

  it('間隔は10〜3600秒の整数だけを受け付ける', async () => {
    const { deps, intervals } = setup({ api: api({ healthy: true }, STATUS) });
    await script.initMuseWasmTest(deps);
    const input = $<HTMLInputElement>('mwt-interval');
    input.value = '5';
    input.dispatchEvent(new Event('change'));
    expect($('mwt-interval-error').textContent).toContain('10');
    input.value = '60';
    input.dispatchEvent(new Event('change'));
    expect($('mwt-interval-error').textContent).toBe('');
    expect(intervals.filter((i) => !i.cleared).map((i) => i.ms)).toEqual([60_000]);
  });
});

describe('/muse-wasm-testの要望(Workerのジョブ台帳 MuseAgentJobs)', () => {
  beforeEach(loadBody);
  const JOBS_URL = '/api/tailscale-wasm/jobs';
  const isPost = (init: unknown) => (init as { method?: string } | undefined)?.method === 'POST';

  it('要望をWorkerのジョブ台帳へ送り(コンテナのbridge_jobsへは積まない)、一覧に状態とMuseの返事を文字として出す', async () => {
    const jobs = [{ jobId: 'job-1', createdAt: '2026-11-10T23:30:00Z', messages: [
      { messageId: 'm-1', agent: 'user', prompt: '<b>muse-monitorのテスト</b>', state: 'done', reply: '<script>x</script>確認しました' },
    ] }];
    const { deps, fetchJson } = setup({ api: async (url, init) => (isPost(init) ? { ok: true, jobId: 'job-1', messageId: 'm-1', state: 'queued' } : url === JOBS_URL ? { jobs } : {}) });
    await script.initMuseWasmTest(deps);
    $<HTMLTextAreaElement>('mwt-request').value = '  muse-monitorのテスト  ';
    $('mwt-submit').click();
    await flush(); await flush();
    const post = fetchJson.mock.calls.find(([, init]) => isPost(init))!;
    expect(post[0]).toBe(JOBS_URL);
    const body = JSON.parse((post[1] as { body: string }).body);
    expect(body.prompt).toBe('muse-monitorのテスト');
    expect(body.requestId).toMatch(/^[a-zA-Z0-9-]{1,64}$/);
    expect(fetchJson.mock.calls.some(([url]) => String(url).includes('/api/muse-wasm-test/jobs'))).toBe(false);
    expect($('mwt-submit-result').textContent).toContain('m-1');
    expect($<HTMLTextAreaElement>('mwt-request').value).toBe('');
    const list = $('mwt-jobs');
    expect(list.textContent).toContain('<b>muse-monitorのテスト</b>');
    expect(list.textContent).toContain('<script>x</script>確認しました');
    expect(list.textContent).toContain('done');
    expect(list.querySelector('b, script')).toBeNull();
  });

  it('処理中(queued・sending)がある間は5秒ごとに一覧を読み直し、片付いたら止める', async () => {
    let state = 'queued';
    const { deps, intervals, fetchJson } = setup({ api: async (_url, init) => (isPost(init) ? { ok: true, jobId: 'j', messageId: 'm', state: 'queued' } : { jobs: [{ jobId: 'j', createdAt: 'x', messages: [{ messageId: 'm', agent: 'user', prompt: 'p', state, reply: null }] }] }) });
    await script.initMuseWasmTest(deps);
    $<HTMLTextAreaElement>('mwt-request').value = '要望';
    $('mwt-submit').click();
    await flush(); await flush();
    const poll = intervals.filter((i) => !i.cleared && i.ms === 5000);
    expect(poll).toHaveLength(1);
    const before = fetchJson.mock.calls.length;
    state = 'done';
    poll[0].fn();
    await flush(); await flush();
    expect(fetchJson.mock.calls.length).toBe(before + 1);
    expect(poll[0].cleared).toBe(true);
  });

  it('失敗や再試行の理由を一覧に出す', async () => {
    const jobs = [{ jobId: 'j', createdAt: 'x', messages: [
      { messageId: 'm1', agent: 'user', prompt: 'p1', state: 'failed', reply: null, error: 'HTTP 503 muse_not_authenticated' },
      { messageId: 'm2', agent: 'user', prompt: 'p2', state: 'queued', reply: null, error: 'HTTP 503 tailscale_not_connected (attempt 1/5, retrying)' },
    ] }];
    const { deps } = setup({ api: async (url) => (url === '/api/tailscale-wasm/jobs' ? { jobs } : {}) });
    await script.initMuseWasmTest(deps);
    await flush(); await flush();
    const text = $('mwt-jobs').textContent ?? '';
    expect(text).toContain('muse_not_authenticated');
    expect(text).toContain('attempt 1/5, retrying');
  });

  it('空の要望は送らない', async () => {
    const { deps, fetchJson } = setup({ api: async () => ({ jobs: [] }) });
    await script.initMuseWasmTest(deps);
    $<HTMLTextAreaElement>('mwt-request').value = '  ';
    $('mwt-submit').click();
    await flush();
    expect(fetchJson.mock.calls.some(([, init]) => isPost(init))).toBe(false);
    expect($('mwt-submit-result').textContent).toContain('要望');
  });

  it('APIのエラーはそのまま表示し、入力を残す', async () => {
    const { deps } = setup({ api: async (_url, init) => (isPost(init) ? { error: 'tailscale_wasm_not_configured' } : { jobs: [] }) });
    await script.initMuseWasmTest(deps);
    $<HTMLTextAreaElement>('mwt-request').value = '要望';
    $('mwt-submit').click();
    await flush(); await flush();
    expect($('mwt-submit-result').textContent).toContain('tailscale_wasm_not_configured');
    expect($<HTMLTextAreaElement>('mwt-request').value).toBe('要望');
  });
});

describe('/muse-wasm-testのmuse-monitor', () => {
  beforeEach(loadBody);
  const SECTIONS = ['status', 'diag', 'sdkhealth', 'sdkprofiles', 'sdksessions', 'sdkts', 'jobs', 'pending', 'execlog', 'pkgs', 'vm', 'procs', 'ports', 'git', 'recent'];

  it('「全て取得」で15項目を/api/muse-monitor/<section>から取り、内容を文字として表に出す', async () => {
    const { deps, fetchJson } = setup({
      api: async (url) => {
        if (url === '/api/tailscale-wasm/jobs') return { jobs: [] };
        const section = url.split('/').pop();
        return section === 'status'
          ? { status: 200, body: { node: 'Running', receiver: { resolvedIp: '100.86.29.77' } } }
          : { status: 200, body: { section, rc: 0, output: '<b>' + section + '</b> ok' } };
      },
    });
    await script.initMuseWasmTest(deps);
    $('mwt-mon-all').click();
    await flush(); await flush();
    const urls = fetchJson.mock.calls.map(([url]) => url).filter((u) => String(u).startsWith('/api/muse-monitor/'));
    expect(urls).toEqual(SECTIONS.map((s) => '/api/muse-monitor/' + s));
    const rows = $('mwt-mon-log').querySelectorAll('tr');
    expect(rows).toHaveLength(15);
    expect($('mwt-mon-log').textContent).toContain('<b>jobs</b> ok');
    expect($('mwt-mon-log').querySelector('b')).toBeNull();
    expect($('mwt-mon-log').textContent).toContain('100.86.29.77');
  });

  it('選んだ1項目だけを取る', async () => {
    const { deps, fetchJson } = setup({ api: async (url) => (url === '/api/tailscale-wasm/jobs' ? { jobs: [] } : { status: 200, body: { output: 'vm info' } }) });
    await script.initMuseWasmTest(deps);
    $<HTMLInputElement>('mwt-mon-section').value = 'vm';
    $('mwt-mon-get').click();
    await flush(); await flush();
    expect(fetchJson.mock.calls.map(([url]) => url).filter((u) => String(u).startsWith('/api/muse-monitor/'))).toEqual(['/api/muse-monitor/vm']);
    expect($('mwt-mon-log').textContent).toContain('vm info');
  });

  it('失敗は理由(errorCode・説明・muse-monitorの本文)を表に残す', async () => {
    const { deps } = setup({
      api: async (url) => {
        if (url === '/api/tailscale-wasm/jobs') return { jobs: [] };
        if (url.endsWith('/diag')) return { error: '本体とmuse-monitorのMONITOR_HMAC_SECRETが同じ値か', errorCode: 'hmac_rejected', upstreamStatus: 401 };
        return { status: 502, body: { error: 'receiver_not_found', message: 'no reachable peer named muse-vm(-*)' } };
      },
    });
    await script.initMuseWasmTest(deps);
    $<HTMLInputElement>('mwt-mon-section').value = 'diag';
    $('mwt-mon-get').click();
    $<HTMLInputElement>('mwt-mon-section').value = 'jobs';
    $('mwt-mon-get').click();
    await flush(); await flush();
    const rows = [...$('mwt-mon-log').querySelectorAll('tr')];
    expect(rows.every((r) => r.classList.contains('mwt-ng'))).toBe(true);
    const text = $('mwt-mon-log').textContent ?? '';
    expect(text).toContain('hmac_rejected');
    expect(text).toContain('MONITOR_HMAC_SECRET');
    expect(text).toContain('receiver_not_found');
    expect(text).toContain('no reachable peer');
  });

  it('通信の失敗も表に残す', async () => {
    const { deps } = setup({ api: async (url) => { if (url === '/api/tailscale-wasm/jobs') return { jobs: [] }; throw new Error('Failed to fetch'); } });
    await script.initMuseWasmTest(deps);
    $('mwt-mon-get').click();
    await flush(); await flush();
    expect($('mwt-mon-log').textContent).toContain('Failed to fetch');
  });
});

describe('getMuseWasmTestPage', () => {
  it('生成HTMLの全scriptがnode --checkに通る', () => {
    const page = new DOMParser().parseFromString(getMuseWasmTestPage(), 'text/html');
    const scripts = [...page.querySelectorAll('script')];
    expect(scripts.length).toBeGreaterThan(0);
    for (const s of scripts) {
      const source = s.type === 'module' ? s.textContent ?? '' : s.textContent ?? '';
      expect(() => execFileSync(process.execPath, ['--input-type=module', '--check'], { input: source })).not.toThrow();
    }
  });
  it('ブラウザ用のTailscale WASMは読み込まない(ログインはWorkerのノードだけ)。CSPは/muse-statusと同じ', () => {
    const html = getMuseWasmTestPage();
    expect(html).not.toContain('tailscale-wasm-client');
    expect(html).not.toContain('tailscale-connect');
    expect(MUSE_WASM_TEST_CSP).toBe(MUSE_STATUS_CSP);
  });
});
