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
  const fetchJson = vi.fn(options.api ?? (async (url: string) => (url.endsWith('/jobs') ? { jobs: [] } : {})));
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

describe('/muse-wasm-testのTailscale WASM', () => {
  beforeEach(loadBody);

  it('接続するとtailscale.comのログインURLだけをリンクにする', async () => {
    const { deps, client, callbacks } = setup();
    await script.initMuseWasmTest(deps);
    $('mwt-connect').click();
    await flush();
    expect(client.login).toHaveBeenCalledOnce();
    callbacks().notifyBrowseToURL('https://evil.example/a/1');
    expect($('mwt-login').querySelector('a')).toBeNull();
    callbacks().notifyBrowseToURL('https://login.tailscale.com/a/abc');
    expect($('mwt-login').querySelector('a')?.getAttribute('href')).toBe('https://login.tailscale.com/a/abc');
  });

  it('Runningになるとmuse-vmの名前とIPの/healthへGETを送り、結果を文字として記録し、間隔ごとに繰り返す', async () => {
    const { deps, client, intervals, callbacks } = setup({ fetchImpl: async () => ({ status: 200, statusText: '200 OK', text: async () => '<img src=x>{"status": "ok"}' }) });
    await script.initMuseWasmTest(deps);
    $('mwt-connect').click();
    await flush();
    callbacks().notifyNetMap(NETMAP);
    callbacks().notifyState('Running');
    await flush(); await flush();
    expect((client.fetch as ReturnType<typeof vi.fn>).mock.calls.map(([url]) => url)).toEqual(['http://muse-vm:8080/health', 'http://100.86.29.77:8080/health']);
    expect($('mwt-node').textContent).toContain('100.86.29.77');
    const rows = $('mwt-log').querySelectorAll('tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('200');
    expect(rows[0].textContent).toContain('<img src=x>');
    expect($('mwt-log').querySelector('img')).toBeNull();
    const active = intervals.filter((i) => !i.cleared);
    expect(active).toHaveLength(1);
    expect(active[0].ms).toBe(30_000);
    active[0].fn();
    await flush(); await flush();
    expect(client.fetch).toHaveBeenCalledTimes(4);
  });

  it('届かなかったときは理由を記録に残す', async () => {
    const { deps, callbacks } = setup({ fetchImpl: async () => { throw new Error('dial tcp: no route'); } });
    await script.initMuseWasmTest(deps);
    $('mwt-connect').click();
    await flush();
    callbacks().notifyNetMap(NETMAP);
    callbacks().notifyState('Running');
    await flush(); await flush();
    expect($('mwt-log').textContent).toContain('dial tcp: no route');
  });

  it('netmapにmuse-vmが無ければ名前だけに送る', async () => {
    const { deps, client, callbacks } = setup();
    await script.initMuseWasmTest(deps);
    $('mwt-connect').click();
    await flush();
    callbacks().notifyNetMap(JSON.stringify({ peers: [] }));
    callbacks().notifyState('Running');
    await flush(); await flush();
    expect((client.fetch as ReturnType<typeof vi.fn>).mock.calls.map(([url]) => url)).toEqual(['http://muse-vm:8080/health']);
  });

  it('切断するとログアウトし、定期送信を止める', async () => {
    const { deps, client, intervals, callbacks } = setup();
    await script.initMuseWasmTest(deps);
    $('mwt-connect').click();
    await flush();
    callbacks().notifyState('Running');
    await flush();
    $('mwt-disconnect').click();
    expect(client.logout).toHaveBeenCalledOnce();
    expect(intervals.every((i) => i.cleared)).toBe(true);
  });

  it('間隔は10〜3600秒の整数だけを受け付ける', async () => {
    const { deps, intervals, callbacks } = setup();
    await script.initMuseWasmTest(deps);
    $('mwt-connect').click();
    await flush();
    callbacks().notifyState('Running');
    await flush();
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

describe('/muse-wasm-testの要望', () => {
  beforeEach(loadBody);

  it('要望をAPIへ送ってjob idを表示し、一覧を読み直す', async () => {
    const jobs = [{ jobId: 'a'.repeat(32), createdAt: 1794139200, requestText: '<b>READMEを要約</b>', externalWrite: false, status: 'done', attempts: 1, maxAttempts: 3, claimedBy: 'codex@cf', lastError: null, resultText: '<script>x</script>要約です', resultTruncated: false, exitCode: 0 }];
    const { deps, fetchJson } = setup({
      api: async (url, init) => (init?.method === 'POST' ? { jobId: 'a'.repeat(32) } : { jobs }),
    });
    await script.initMuseWasmTest(deps);
    $<HTMLTextAreaElement>('mwt-request').value = '  READMEを要約  ';
    $<HTMLInputElement>('mwt-external').checked = true;
    $('mwt-submit').click();
    await flush(); await flush();
    const post = fetchJson.mock.calls.find(([, init]) => (init as { method?: string } | undefined)?.method === 'POST')!;
    expect(post[0]).toBe('/api/muse-wasm-test/jobs');
    expect(JSON.parse((post[1] as { body: string }).body)).toEqual({ request: 'READMEを要約', external: true });
    expect($('mwt-submit-result').textContent).toContain('a'.repeat(32));
    expect($<HTMLTextAreaElement>('mwt-request').value).toBe('');
    const list = $('mwt-jobs');
    expect(list.textContent).toContain('<b>READMEを要約</b>');
    expect(list.textContent).toContain('<script>x</script>要約です');
    expect(list.textContent).toContain('done');
    expect(list.querySelector('b, script')).toBeNull();
  });

  it('空の要望は送らない', async () => {
    const { deps, fetchJson } = setup();
    await script.initMuseWasmTest(deps);
    $<HTMLTextAreaElement>('mwt-request').value = '  ';
    $('mwt-submit').click();
    await flush();
    expect(fetchJson.mock.calls.some(([, init]) => (init as { method?: string } | undefined)?.method === 'POST')).toBe(false);
    expect($('mwt-submit-result').textContent).toContain('要望');
  });

  it('APIのエラーはそのまま表示し、入力を残す', async () => {
    const { deps } = setup({ api: async (_url, init) => (init?.method === 'POST' ? { error: '協議の記録(INQUIRY_DB)が未設定です' } : { jobs: [] }) });
    await script.initMuseWasmTest(deps);
    $<HTMLTextAreaElement>('mwt-request').value = '要望';
    $('mwt-submit').click();
    await flush(); await flush();
    expect($('mwt-submit-result').textContent).toContain('INQUIRY_DB');
    expect($<HTMLTextAreaElement>('mwt-request').value).toBe('要望');
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
  it('WASMは同一オリジンの共通ローダーから読み、CSPは/muse-statusと同じ', () => {
    const html = getMuseWasmTestPage();
    expect(html).toContain("import('/tailscale-wasm-client.mjs')");
    expect(html).not.toMatch(/https?:\/\/[^"'\s]*tailscale-connect/);
    expect(MUSE_WASM_TEST_CSP).toBe(MUSE_STATUS_CSP);
  });
});
