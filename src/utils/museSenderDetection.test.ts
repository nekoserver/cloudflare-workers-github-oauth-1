/**
 * muse-vm の送信者判定が誤作動する場合のテスト(2026-11-12)。
 *
 * 本番で起きたこと: AIチャットから送ると muse-vm に届く(Muse の通知が来る)のに、送信者の判定が外れて「回答しないモード」に入り、
 * 600秒後に短いエラーが返った。tree-view の Museタブ(Worker内WASM・dynamicneko の鍵)では数秒で返事が返った。
 * AIチャットは⚙の旧コンテナ直通(別の tailnet ノード)・本体の鍵で送っていた。
 *
 * 偽の muse-vm は、届いた要求の Authorization の鍵で送信者を判定し、知らない鍵なら返事をしない(回答しないモード)。
 * 本物の中継(WasmMuseBridge)を通して、次の仮説を確かめる。
 *   1. 送信者が正しく判定されるなら、AIチャットの要求は tree-view の要求と muse-vm から見て同じ(同じノード・同じ鍵・同じ本文)でないとおかしい。
 *   2. 中継が起動時に読んだ鍵と ENV の鍵が違っても、muse-vm に届くのは ENV の鍵でないとおかしい(ENV 以外の鍵を付けない)。
 *   3. 送信者の判定が外れたら、AIチャットは300秒待たず90秒で打ち切り、経路IDをログに残さないとおかしい。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WasmMuseBridge } from './wasmMuseBridge';
import { MUSE_WORKER_MAX_TIMEOUT_SECONDS, museWorkerDep, sendMuseViaWorker } from './museWorkerAsk';

const MUSE_VM_KEY = 'muse-vm-registered-key';

type Seen = { url: string; authorization?: string; body?: string };

/** 鍵で送信者を判定する偽の muse-vm。/health には誰にでも答える(本番でも /health は通っていた)。 */
function fakeMuseVm(seen: Seen[]) {
  const encoder = new TextEncoder();
  const respond = (status: number, payload: unknown) => {
    let sent = false;
    return { status, headers: [['Content-Type', 'application/json']] as [string, string][], cancel: () => {}, read: async () => { if (sent) return null; sent = true; return encoder.encode(JSON.stringify(payload)); } };
  };
  return {
    status: () => JSON.stringify({ state: 'Running', peers: [{ name: 'muse-vm', online: true }] }),
    fetch: (request: { url: string; headers?: [string, string][]; body?: Uint8Array }) => {
      const authorization = request.headers?.find(([name]) => name === 'Authorization')?.[1];
      if (request.url.endsWith('/health')) return Promise.resolve(respond(200, { status: 'ok' }));
      seen.push({ url: request.url, authorization, body: request.body ? new TextDecoder().decode(request.body) : undefined });
      if (authorization !== 'Bearer ' + MUSE_VM_KEY) return new Promise<never>(() => {}); // 送信者の判定が外れた: 回答しないモード
      return Promise.resolve(respond(200, { model: 'muse', choices: [{ message: { content: '2' } }] }));
    },
  };
}

/** 本物の中継を、Worker から見た TAILSCALE_WASM として包む。startupKey は中継が起動時に読んだ鍵。 */
function bridgeNamespace(seen: Seen[], startupKey: string) {
  const bridge = new WasmMuseBridge(fakeMuseVm(seen) as never, startupKey);
  return { idFromName: () => 'muse', get: () => ({ fetch: (request: Request) => bridge.fetch(request) }) };
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('muse-vm の送信者判定', () => {
  it('AIチャットの要求は、muse-vm から見て tree-view の要求と同じ(同じ鍵・同じ本文)', async () => {
    const fromTreeView: Seen[] = [];
    const tree = await sendMuseViaWorker({ TAILSCALE_WASM: bridgeNamespace(fromTreeView, 'startup') as never }, [{ role: 'user', content: '1+1は?' }], { routeId: 'treeview-musetab-wasm', apiKey: MUSE_VM_KEY });
    const fromAichat: Seen[] = [];
    const aichat = await museWorkerDep({ TAILSCALE_WASM: bridgeNamespace(fromAichat, 'startup') as never, MUSE_API_KEY: MUSE_VM_KEY })('1+1は?');
    expect(tree).toMatchObject({ ok: true, reply: '2' });
    expect(aichat).toMatchObject({ ok: true, reply: '2' });
    expect(fromAichat).toEqual(fromTreeView);
  });

  it('中継が起動時に読んだ鍵が古くても、muse-vm に届くのは ENV の鍵(ENV 以外の鍵を付けない)', async () => {
    const seen: Seen[] = [];
    const result = await museWorkerDep({ TAILSCALE_WASM: bridgeNamespace(seen, 'stale-startup-key') as never, MUSE_API_KEY: MUSE_VM_KEY })('1+1は?');
    expect(result).toMatchObject({ ok: true, reply: '2' });
    expect(seen.map(x => x.authorization)).toEqual(['Bearer ' + MUSE_VM_KEY]);
  });

  it('送信者の判定が外れる(muse-vm が回答しないモード)と、AIチャットは90秒で打ち切り、経路IDをログに残す', async () => {
    vi.useFakeTimers();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const seen: Seen[] = [];
    const pending = museWorkerDep({ TAILSCALE_WASM: bridgeNamespace(seen, 'startup') as never, MUSE_API_KEY: 'key-muse-vm-does-not-know' })('1+1は?');
    let settled: unknown;
    void pending.then(x => { settled = x; });
    await vi.advanceTimersByTimeAsync(MUSE_WORKER_MAX_TIMEOUT_SECONDS * 1000 - 1);
    expect(settled).toBeUndefined();
    expect(seen).toHaveLength(1); // muse-vm には届いている(本番で通知が来たのと同じ)
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toMatchObject({ ok: false, error: 'llm_timeout' });
    const line = log.mock.calls.map(c => String(c[0])).find(x => x.startsWith('[muse-worker]'));
    expect(JSON.parse(line!.slice('[muse-worker] '.length))).toMatchObject({ routeId: 'aichat-direct', error: 'llm_timeout', keyPrefix: 'key-' });
    expect(line).not.toContain('muse-vm-does-not-know');
  });
});
