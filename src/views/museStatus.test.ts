// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMuseStatusPage, MUSE_STATUS_SCRIPT, MUSE_STATUS_SIGNAL_DEFAULT_SECONDS } from './museStatus';

type Script = {
  initMuseStatusPage(deps: unknown): Promise<unknown>;
  createMuseSignalSchedule(options: unknown): { apply(): void; stop(): void; checkIfDue(): void };
  readMuseStatusSettings(cookie: string): { enabled: boolean; intervalSeconds: number };
};
const script = new Function(`${MUSE_STATUS_SCRIPT}\nreturn { initMuseStatusPage, createMuseSignalSchedule, readMuseStatusSettings };`)() as Script;
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
    expect(signalCalls(fetchJson)).toBe(2);
    expect(field('muse', 'signal').textContent).toBe('稼働中');
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
    expect(field('muse', 'signal').textContent).toBe('未送信');
  });

  // 2026-11-07: Tailscaleではオンラインなのに「接続できません」になり、理由が分からなかった。
  it('接続できないときは理由(ncのエラー出力)を文字として表示し、オンラインならTailscale以外の原因だと案内する', async () => {
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify({ enabled: false, intervalSeconds: 120 }))}; path=/`;
    const fetchJson = api({ '/api/muse-status/signal': { node: 'muse', code: 'connection_failed', latencyMs: null, checkedAt: '2026-11-06T00:00:00Z', detail: '<img src=x>connection refused' } });
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson });
    (card('muse').querySelector('[data-action="signal"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(field('muse', 'signal').textContent).toBe('接続できません'));
    const detail = field('muse', 'signalDetail');
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
    const fetchJson = api({ '/api/muse-status/nix?node=muse': {
      node: 'muse', state: 'ok', total: 2, truncated: false, generatedAt: null,
      packages: [{ name: '<img src=x onerror=alert(1)>', version: null }, { name: 'hello', version: '2.12' }],
    } });
    await script.initMuseStatusPage({ document, nodes: NODES, fetchJson });
    const rows = field('muse', 'nixRows');
    expect(rows.querySelectorAll('tr')).toHaveLength(2);
    expect(rows.querySelector('img')).toBeNull();
    expect(field('muse', 'nixTable').hidden).toBe(false);
    const filter = card('muse').querySelector('[data-action="nixFilter"]') as HTMLInputElement;
    filter.value = 'HEL';
    filter.dispatchEvent(new Event('input'));
    expect(rows.querySelectorAll('tr')).toHaveLength(1);
    expect(field('muse', 'nixSummary').textContent).toContain('一致 1件');
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
    expect(field('muse', 'online').textContent).toBe('tailnetに見つかりません');
  });
});

describe('getMuseStatusPage', () => {
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
